import { randomUUID } from "node:crypto";
import type { Request } from "express";
import { z } from "zod";
import type { CatalogStore } from "../db.js";
import { NoXLogin, digest, secret, type Credentials, type Transaction } from "../nox-login.js";
import {
  AccessError,
  audit,
  requirePermission,
  rolePermissions,
  type Actor,
  type Permission,
  type Role,
} from "./storage.js";

type SessionRow = {
  hash: string;
  issuer: string;
  subject: string;
  credential: string;
  expires: number;
  renew_at: number;
  csrf: string;
};
type Principal = { issuer: string; subject: string; email: string; name: string; role: Role };
export const cookieNames = { session: "pc_admin_session", transaction: "pc_login_transaction" };
export function cookie(req: Request, name: string): string | undefined {
  const matches = (req.headers.cookie ?? "")
    .split(";")
    .map((item) => item.trim().split("="))
    .filter(([key]) => key === name);
  return matches.length === 1 && /^[A-Za-z0-9_-]{43}$/.test(matches[0][1] ?? "")
    ? matches[0][1]
    : undefined;
}
export class AdminAuth {
  readonly #decisions = new Map<string, { started: number; until: number }>();
  readonly #pending = new Map<string, Promise<void>>();
  constructor(
    readonly store: CatalogStore,
    readonly login: NoXLogin | undefined,
    readonly ownerEmail: string,
  ) {}
  get enabled() {
    return Boolean(this.login);
  }
  assertOrigin(req: Request) {
    if (!this.login || req.headers.origin !== this.login.config.publicOrigin)
      throw new AccessError("invalid_origin");
  }
  start(returnPath = "/admin") {
    let decoded: string;
    try {
      decoded = decodeURIComponent(returnPath);
    } catch {
      throw new AccessError("invalid_input", 400);
    }
    if (
      returnPath.length > 2000 ||
      decoded.includes("\\") ||
      Array.from(decoded).some((character) => character.charCodeAt(0) < 32) ||
      !(decoded === "/admin" || decoded.startsWith("/admin/") || decoded.startsWith("/admin?")) ||
      new URL(returnPath, "http://local").origin !== "http://local"
    )
      throw new AccessError("invalid_input", 400);
    if (!this.login) throw new AccessError("auth_not_configured", 503);
    const db = this.store.database;
    return db.transaction(() => {
      db.prepare("DELETE FROM auth_transactions WHERE expires <= ?").run(Date.now());
      const count = db.prepare("SELECT count(*) AS n FROM auth_transactions").get() as {
        n: number;
      };
      if (count.n >= 1000) throw new AccessError("too_many_requests", 429);
      const { transaction, url } = this.login!.begin();
      const browser = secret();
      db.prepare(
        "INSERT INTO auth_transactions(hash,state,nonce,verifier,created,expires,return_path) VALUES (?,?,?,?,?,?,?)",
      ).run(
        digest(browser),
        transaction.state,
        transaction.nonce,
        transaction.verifier,
        transaction.created,
        transaction.expires,
        returnPath,
      );
      return { browser, url };
    })();
  }
  async complete(browser: string | undefined, query: URLSearchParams, previous?: string) {
    if (!this.login || !browser) throw new AccessError("login_denied", 401);
    const db = this.store.database;
    const transaction = db
      .prepare(
        "DELETE FROM auth_transactions WHERE hash = ? RETURNING state,nonce,verifier,created,expires,return_path",
      )
      .get(digest(browser)) as (Transaction & { return_path: string }) | undefined;
    if (!transaction) throw new AccessError("login_denied", 401);
    const credentials = await this.login.complete(transaction, query);
    const issuer = this.login.config.issuer,
      subject = credentials.identity.sub;
    const raw = secret(),
      hash = digest(raw),
      csrf = secret();
    db.transaction(() => {
      if (previous) this.invalidate(digest(previous));
      const exists = db
        .prepare("SELECT * FROM auth_principals WHERE issuer = ? AND subject = ?")
        .get(issuer, subject) as Principal | undefined;
      const owners = db
        .prepare("SELECT count(*) AS n FROM auth_principals WHERE role = 'owner'")
        .get() as { n: number };
      const bootstrapOwner =
        !owners.n && credentials.identity.email.toLowerCase() === this.ownerEmail.toLowerCase();
      const role: Role = bootstrapOwner ? "owner" : (exists?.role ?? "unassigned");
      db.prepare(
        "INSERT INTO auth_principals(issuer,subject,email,name,role) VALUES (?,?,?,?,?) ON CONFLICT(issuer,subject) DO UPDATE SET email = excluded.email,name = excluded.name",
      ).run(issuer, subject, credentials.identity.email, credentials.identity.name, role);
      if (bootstrapOwner)
        db.prepare(
          "UPDATE auth_principals SET role = 'owner' WHERE issuer = ? AND subject = ?",
        ).run(issuer, subject);
      db.prepare("DELETE FROM auth_sessions WHERE expires <= ?").run(Date.now());
      db.prepare(
        "INSERT INTO auth_sessions(hash,issuer,subject,credential,expires,renew_at,csrf,created) VALUES (?,?,?,?,?,?,?,?)",
      ).run(
        hash,
        issuer,
        subject,
        JSON.stringify(credentials),
        credentials.expires,
        credentials.renewAt,
        csrf,
        Date.now(),
      );
    })();
    return { raw, expires: credentials.expires, returnPath: transaction.return_path };
  }
  async session(hash: string): Promise<Actor> {
    if (!this.login) throw new AccessError("auth_not_configured", 503);
    const db = this.store.database;
    let row = db.prepare("SELECT * FROM auth_sessions WHERE hash = ?").get(hash) as
      | SessionRow
      | undefined;
    if (!row || row.expires <= Date.now()) {
      this.invalidate(hash);
      throw new AccessError("not_authenticated", 401);
    }
    const cached = this.#decisions.get(hash);
    if (!cached || Date.now() < cached.started || Date.now() >= cached.until) {
      let validation = this.#pending.get(hash);
      if (!validation) {
        const credential = JSON.parse(row.credential) as Credentials;
        validation = this.login
          .check(credential)
          .then((result) => {
            const changes = db
              .prepare("UPDATE auth_sessions SET credential = ?, expires = ? WHERE hash = ?")
              .run(
                JSON.stringify({
                  ...credential,
                  identity: result.identity,
                  expires: result.expires,
                }),
                result.expires,
                hash,
              ).changes;
            if (!changes) throw new AccessError("not_authenticated", 401);
            if (this.#decisions.size >= 1000)
              this.#decisions.delete(this.#decisions.keys().next().value!);
            this.#decisions.set(hash, { started: Date.now(), until: result.validUntil });
            db.prepare(
              "UPDATE auth_principals SET email = ?,name = ? WHERE issuer = ? AND subject = ?",
            ).run(
              result.identity.email,
              result.identity.name,
              this.login!.config.issuer,
              result.identity.sub,
            );
          })
          .catch((error) => {
            this.#decisions.delete(hash);
            if (error instanceof Error && error.message === "auth_unavailable")
              throw new AccessError("auth_unavailable", 503);
            this.invalidate(hash);
            throw new AccessError("not_authenticated", 401);
          })
          .finally(() => this.#pending.delete(hash));
        this.#pending.set(hash, validation);
      }
      await validation;
    }
    row = db.prepare("SELECT * FROM auth_sessions WHERE hash = ?").get(hash) as
      | SessionRow
      | undefined;
    if (!row) throw new AccessError("not_authenticated", 401);
    if (row.renew_at <= Date.now()) throw new AccessError("login_renewal_required", 401);
    const principal = db
      .prepare("SELECT * FROM auth_principals WHERE issuer = ? AND subject = ?")
      .get(row.issuer, row.subject) as Principal;
    return {
      ...principal,
      scopes: rolePermissions[principal.role],
      channel: "web",
      sessionHash: hash,
      csrf: row.csrf,
    };
  }
  async fromRequest(req: Request): Promise<Actor> {
    const browser = cookie(req, cookieNames.session);
    if (!browser) throw new AccessError("not_authenticated", 401);
    return this.session(digest(browser));
  }
  invalidate(hash: string) {
    this.#decisions.delete(hash);
    this.store.database.prepare("DELETE FROM auth_sessions WHERE hash = ?").run(hash);
  }
  async logout(actor: Actor) {
    const row = this.store.database
      .prepare("SELECT credential FROM auth_sessions WHERE hash = ?")
      .get(actor.sessionHash) as { credential: string } | undefined;
    this.invalidate(actor.sessionHash);
    if (row && this.login) await this.login.logout(JSON.parse(row.credential) as Credentials);
  }
  listUsers(actor: Actor) {
    requirePermission(actor, "pc:admin");
    return this.store.database
      .prepare("SELECT issuer,subject,email,name,role FROM auth_principals ORDER BY email")
      .all();
  }
  setRole(actor: Actor, input: unknown) {
    requirePermission(actor, "pc:admin");
    const data = z
      .object({
        issuer: z.string(),
        subject: z.string().min(1),
        role: z.enum(["unassigned", "viewer", "editor", "publisher", "owner"]),
      })
      .strict()
      .parse(input);
    const db = this.store.database;
    db.transaction(() => {
      const current = db
        .prepare("SELECT role FROM auth_principals WHERE issuer = ? AND subject = ?")
        .get(data.issuer, data.subject) as { role: Role } | undefined;
      if (!current) throw new AccessError("not_found", 404);
      if (
        current.role === "owner" &&
        data.role !== "owner" &&
        (
          db.prepare("SELECT count(*) AS n FROM auth_principals WHERE role = 'owner'").get() as {
            n: number;
          }
        ).n <= 1
      )
        throw new AccessError("last_owner", 409);
      db.prepare("UPDATE auth_principals SET role = ? WHERE issuer = ? AND subject = ?").run(
        data.role,
        data.issuer,
        data.subject,
      );
      audit(this.store, actor, "role_changed", `${data.issuer}|${data.subject}`);
    })();
  }
  createDelegation(actor: Actor, input: unknown) {
    requirePermission(actor, "pc:admin");
    const data = z
      .object({
        name: z.string().trim().min(1).max(100),
        scopes: z
          .array(z.enum(["pc:read", "pc:write", "pc:publish"]))
          .min(1)
          .max(3),
        hours: z.number().int().min(1).max(24),
      })
      .strict()
      .parse(input);
    if (data.scopes.some((scope) => !actor.scopes.includes(scope)))
      throw new AccessError("forbidden");
    const token = secret(),
      id = randomUUID(),
      expires = Date.now() + data.hours * 3600000;
    this.store.database.transaction(() => {
      this.store.database
        .prepare(
          "INSERT INTO auth_delegations(hash,id,name,session_hash,scopes,expires) VALUES (?,?,?,?,?,?)",
        )
        .run(
          digest(token),
          id,
          data.name,
          actor.sessionHash,
          JSON.stringify([...new Set(data.scopes)]),
          expires,
        );
      audit(this.store, actor, "delegation_created", id);
    })();
    return { id, token, expires };
  }
  listDelegations(actor: Actor) {
    requirePermission(actor, "pc:admin");
    return this.store.database
      .prepare(
        "SELECT id,name,scopes,expires,revoked FROM auth_delegations WHERE session_hash = ? ORDER BY expires DESC",
      )
      .all(actor.sessionHash);
  }
  revokeDelegation(actor: Actor, id: string) {
    requirePermission(actor, "pc:admin");
    this.store.database.transaction(() => {
      this.store.database
        .prepare("UPDATE auth_delegations SET revoked = 1 WHERE id = ? AND session_hash = ?")
        .run(id, actor.sessionHash);
      audit(this.store, actor, "delegation_revoked", id);
    })();
  }
  async bearer(req: Request): Promise<Actor> {
    const authorization = req.headers.authorization;
    if (!authorization || !/^Bearer [A-Za-z0-9_-]{43}$/i.test(authorization))
      throw new AccessError("not_authenticated", 401);
    const hash = digest(authorization.slice(7));
    const row = this.store.database
      .prepare("SELECT * FROM auth_delegations WHERE hash = ? AND revoked = 0 AND expires > ?")
      .get(hash, Date.now()) as { session_hash: string; scopes: string } | undefined;
    if (!row) throw new AccessError("not_authenticated", 401);
    const actor = await this.session(row.session_hash);
    const fresh = this.store.database
      .prepare("SELECT scopes FROM auth_delegations WHERE hash = ? AND revoked = 0 AND expires > ?")
      .get(hash, Date.now()) as { scopes: string } | undefined;
    if (!fresh) throw new AccessError("not_authenticated", 401);
    const allowed = JSON.parse(fresh.scopes) as Permission[];
    return {
      ...actor,
      delegationHash: hash,
      csrf: undefined,
      channel: "mcp",
      scopes: actor.scopes.filter((scope) => allowed.includes(scope)),
    };
  }
}
