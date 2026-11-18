import { Router, json, type Request, type Response, type NextFunction } from "express";
import { join } from "node:path";
import { createHttpHandler, type ToolDefinition } from "@nox/mcp";
import { toNodeHandler } from "@nox/mcp/node";
import { z } from "zod";
import { type Actor, AccessError, requirePermission } from "./storage.js";
import { AdminAuth, cookie, cookieNames } from "./auth.js";
import { applicationVersion } from "../version.js";
import { same } from "../nox-login.js";
import { ManagementService, operationDefinitions, type Operation } from "./service.js";

type AsyncRoute = (req: Request, res: Response) => Promise<unknown>;
const route = (action: AsyncRoute) => (req: Request, res: Response, next: NextFunction) => {
  void action(req, res).catch(next);
};
export function managementRoutes(auth: AdminAuth, service: ManagementService) {
  const router = Router();
  const secure = auth.login?.config.publicOrigin.startsWith("https:") ?? true;
  const options = { httpOnly: true, secure, sameSite: "lax" as const, path: "/" };
  const guard = async (req: Request, write = false) => {
    const actor = await auth.fromRequest(req);
    requirePermission(actor, "pc:read");
    if (write) {
      auth.assertOrigin(req);
      if (
        typeof req.headers["x-csrf-token"] !== "string" ||
        !same(req.headers["x-csrf-token"], actor.csrf ?? "")
      )
        throw new AccessError("invalid_csrf");
    }
    return actor;
  };
  router.use((req, res, next) => {
    if (req.path.startsWith("/api/admin") || req.path.startsWith("/auth") || req.path === "/mcp") {
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Referrer-Policy", "no-referrer");
    }
    next();
  });
  router.get(
    "/auth/session",
    route(async (req, res) => {
      if (!auth.enabled || !cookie(req, cookieNames.session)) {
        res.json({ configured: auth.enabled, actor: null });
        return;
      }
      const actor = await auth.fromRequest(req);
      const session = auth.store.database
        .prepare("SELECT expires FROM auth_sessions WHERE hash = ?")
        .get(actor.sessionHash) as { expires: number };
      res.cookie(cookieNames.session, cookie(req, cookieNames.session), {
        ...options,
        expires: new Date(session.expires),
      });
      res.json({
        configured: auth.enabled,
        actor: {
          issuer: actor.issuer,
          subject: actor.subject,
          email: actor.email,
          name: actor.name,
          role: actor.role,
          scopes: actor.scopes,
        },
        csrf: actor.csrf,
      });
    }),
  );
  router.post("/auth/nox/start", (req, res, next) => {
    try {
      auth.assertOrigin(req);
      const started = auth.start(
        typeof req.query.return_to === "string" ? req.query.return_to : "/admin",
      );
      res.cookie(cookieNames.transaction, started.browser, {
        ...options,
        path: "/auth/nox/callback",
        maxAge: 600000,
      });
      res.redirect(303, started.url);
    } catch (error) {
      next(error);
    }
  });
  router.get(
    "/auth/nox/callback",
    route(async (req, res) => {
      res.clearCookie(cookieNames.transaction, { ...options, path: "/auth/nox/callback" });
      try {
        const session = await auth.complete(
          cookie(req, cookieNames.transaction),
          new URL(req.originalUrl, "http://local").searchParams,
          cookie(req, cookieNames.session),
        );
        res.cookie(cookieNames.session, session.raw, {
          ...options,
          expires: new Date(session.expires),
        });
        res.redirect(303, session.returnPath);
      } catch {
        res.redirect(303, "/admin?error=login_denied");
      }
    }),
  );
  router.post(
    "/auth/logout",
    route(async (req, res) => {
      const actor = await auth.fromRequest(req);
      auth.assertOrigin(req);
      if (
        typeof req.headers["x-csrf-token"] !== "string" ||
        !same(req.headers["x-csrf-token"], actor.csrf ?? "")
      )
        throw new AccessError("invalid_csrf");
      res.clearCookie(cookieNames.session, options);
      await auth.logout(actor);
      res.json({ ok: true });
    }),
  );
  router.get(
    "/api/admin/state",
    route(async (req, res) => res.json(service.state(await guard(req)))),
  );
  router.post(
    "/api/admin/execute",
    json({ limit: "3mb" }),
    route(async (req, res) => {
      const abort = new AbortController();
      req.once("aborted", () => abort.abort());
      res.once("close", () => {
        if (!res.writableEnded) abort.abort();
      });
      if (req.aborted || res.destroyed) abort.abort();
      const actor = await guard(req, true);
      const body = z
        .object({
          operation: z.enum(Object.keys(operationDefinitions) as [Operation, ...Operation[]]),
          input: z.unknown(),
        })
        .strict()
        .parse(req.body);
      res.json({ result: service.execute(actor, body.operation, body.input, abort.signal) });
    }),
  );
  router.get(
    "/api/admin/preview",
    route(async (req, res) => {
      const actor = await guard(req);
      const kind = z.enum(["component", "settings", "locale"]).parse(req.query.kind);
      const id = z.string().parse(req.query.id),
        revision = z.coerce.number().int().nonnegative().parse(req.query.revision);
      const operation: Operation =
        kind === "component"
          ? "component_preview"
          : kind === "settings"
            ? "settings_preview"
            : "locale_preview";
      const snapshot = service.execute(
        actor,
        operation,
        kind === "component"
          ? { id, revision }
          : kind === "settings"
            ? { revision }
            : { language: id, revision },
      ) as ReturnType<ManagementService["preview"]>;
      for (const component of snapshot.components)
        component.images = component.images.map((image) =>
          image.startsWith("/media/") ? `/api/admin/assets/${image.slice(7)}/file` : image,
        );
      res.json(snapshot);
    }),
  );
  router.get(
    "/api/admin/assets/:id/file",
    route(async (req, res) => {
      await guard(req);
      const asset = service.asset(req.params.id);
      if (!asset) throw new AccessError("not_found", 404);
      res.setHeader("Content-Type", asset.content_type);
      res.sendFile(join(service.mediaDirectory, asset.id));
    }),
  );
  router.get("/media/:id", (req, res, next) => {
    try {
      const asset = service.asset(req.params.id, true);
      if (!asset) throw new AccessError("not_found", 404);
      res.setHeader("Content-Type", asset.content_type);
      res.sendFile(join(service.mediaDirectory, asset.id));
    } catch (error) {
      next(error);
    }
  });
  router.get(
    "/api/admin/users",
    route(async (req, res) => res.json(auth.listUsers(await guard(req)))),
  );
  router.post(
    "/api/admin/users",
    json({ limit: "8kb" }),
    route(async (req, res) => {
      auth.setRole(await guard(req, true), req.body);
      res.json({ ok: true });
    }),
  );
  router.get(
    "/api/admin/delegations",
    route(async (req, res) => res.json(auth.listDelegations(await guard(req)))),
  );
  router.post(
    "/api/admin/delegations",
    json({ limit: "8kb" }),
    route(async (req, res) => res.json(auth.createDelegation(await guard(req, true), req.body))),
  );
  router.delete(
    "/api/admin/delegations/:id",
    route(async (req, res) => {
      auth.revokeDelegation(await guard(req, true), req.params.id);
      res.json({ ok: true });
    }),
  );
  const toolsFor = (actor: Actor): ToolDefinition[] =>
    Object.entries(operationDefinitions)
      .filter(([, definition]) => actor.scopes.includes(definition.permission))
      .map(([operation, definition]) => ({
        name: `pc_${operation}`,
        description: `PC Configurator management operation: ${operation}. Saving a draft does not publish it. Mutations require the current revision; never retry a mutation after an uncertain response.`,
        inputSchema: definition.schema,
        outputSchema: z.object({ result: z.unknown() }),
        requiredScopes: [definition.permission],
        annotations: {
          readOnlyHint: definition.readOnly,
          destructiveHint: !definition.readOnly,
          idempotentHint: definition.readOnly,
          openWorldHint: false,
        },
        execute: async (input, context) => ({
          result: service.execute(actor, operation as Operation, input, context.signal),
        }),
      }));
  const handler = createHttpHandler({
    appId: "pc-configurator",
    name: "pc-configurator",
    version: applicationVersion,
    tools: [],
    timeoutMs: 15000,
    maxPayloadBytes: 3 * 1024 * 1024,
    maxInFlightRequests: 8,
    resolveAuth: (info) => {
      const actor = info?.extra?.actor as Actor | undefined;
      return actor ? { userId: actor.subject, scopes: actor.scopes } : { scopes: [] };
    },
    resolveTools: (info) => {
      const actor = info?.extra?.actor as Actor | undefined;
      return actor ? toolsFor(actor) : [];
    },
    formatError: (error) => ({
      code:
        error instanceof AccessError
          ? error.code
          : error instanceof z.ZodError
            ? "invalid_input"
            : "internal_error",
      message: error instanceof AccessError ? error.code : "operation_failed",
      retryable: false,
    }),
  });
  const nodeHandler = toNodeHandler(handler);
  router.all(
    "/mcp",
    route(async (req, res) => {
      if (req.headers.origin && req.headers.origin !== auth.login?.config.publicOrigin)
        throw new AccessError("invalid_origin");
      const actor = await auth.bearer(req);
      if (req.aborted || res.destroyed) return;
      requirePermission(actor, "pc:read");
      Object.assign(req, {
        auth: {
          token: "verified-local-delegation",
          clientId: "pc-configurator",
          scopes: actor.scopes,
          extra: { actor },
        },
      });
      await nodeHandler(req, res);
    }),
  );
  router.use("/api/admin", (_req, _res, next) => next(new AccessError("not_found", 404)));
  return { router, close: () => handler.close() };
}
