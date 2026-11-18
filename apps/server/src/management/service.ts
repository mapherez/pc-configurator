import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { imageSize } from "image-size";
import {
  ComponentSchema,
  SettingsPatchSchema,
  LocaleValuesSchema,
  LanguageSchema,
  Identifier,
  resolveSettings,
  mergeSettings,
  LocaleOverridesSchema,
  type Snapshot,
  type Component,
} from "@pc-configurator/domain";
import type { CatalogStore } from "../db.js";
import {
  AccessError,
  audit,
  requirePermission,
  type Actor,
  type Permission,
  rolePermissions,
  type Role,
} from "./storage.js";

const revision = z.number().int().nonnegative();
const target = z.object({ id: Identifier, revision }).strict();
export const operationDefinitions = {
  catalog_list: { permission: "pc:read", readOnly: true, schema: z.object({}).strict() },
  catalog_import: {
    permission: "pc:write",
    readOnly: false,
    schema: z
      .object({
        components: z.array(ComponentSchema).min(1).max(100),
        expectedRevisions: z.record(Identifier, revision),
      })
      .strict()
      .superRefine((input, ctx) => {
        if (
          new Set(input.components.map((component) => component.id)).size !==
          input.components.length
        )
          ctx.addIssue({ code: "custom", message: "duplicate_components" });
      }),
  },
  component_save: {
    permission: "pc:write",
    readOnly: false,
    schema: z.object({ component: ComponentSchema, expectedRevision: revision }).strict(),
  },
  component_preview: { permission: "pc:read", readOnly: true, schema: target },
  component_publish: { permission: "pc:publish", readOnly: false, schema: target },
  component_archive: { permission: "pc:publish", readOnly: false, schema: target },
  settings_save: {
    permission: "pc:write",
    readOnly: false,
    schema: z.object({ value: SettingsPatchSchema, expectedRevision: revision }).strict(),
  },
  settings_preview: {
    permission: "pc:read",
    readOnly: true,
    schema: z.object({ revision }).strict(),
  },
  settings_publish: {
    permission: "pc:publish",
    readOnly: false,
    schema: z.object({ revision }).strict(),
  },
  locale_save: {
    permission: "pc:write",
    readOnly: false,
    schema: z
      .object({ language: LanguageSchema, value: LocaleValuesSchema, expectedRevision: revision })
      .strict(),
  },
  locale_preview: {
    permission: "pc:read",
    readOnly: true,
    schema: z.object({ language: LanguageSchema, revision }).strict(),
  },
  locale_publish: {
    permission: "pc:publish",
    readOnly: false,
    schema: z.object({ language: LanguageSchema, revision }).strict(),
  },
  assets_list: { permission: "pc:read", readOnly: true, schema: z.object({}).strict() },
  asset_upload: {
    permission: "pc:write",
    readOnly: false,
    schema: z
      .object({
        filename: z.string().trim().min(1).max(120),
        base64: z.string().min(1).max(2800000),
      })
      .strict(),
  },
  audit_list: {
    permission: "pc:read",
    readOnly: true,
    schema: z.object({ after: revision.default(0) }).strict(),
  },
} as const;
export type Operation = keyof typeof operationDefinitions;
type Document = {
  kind: string;
  id: string;
  revision: number;
  draft: string;
  published_revision: number;
};
export class ManagementService {
  readonly mediaDirectory: string;
  constructor(
    readonly store: CatalogStore,
    dataDirectory: string,
  ) {
    this.mediaDirectory = join(dataDirectory, "assets");
    mkdirSync(this.mediaDirectory, { recursive: true, mode: 0o700 });
  }
  document(kind: string, id: string): Document | undefined {
    return this.store.database
      .prepare("SELECT * FROM admin_documents WHERE kind = ? AND id = ?")
      .get(kind, id) as Document | undefined;
  }
  state(actor: Actor) {
    requirePermission(actor, "pc:read");
    return {
      snapshot: this.store.snapshot(),
      components: this.store.allComponents(),
      documents: (
        this.store.database
          .prepare("SELECT * FROM admin_documents ORDER BY kind,id")
          .all() as Document[]
      ).map((row) => ({ ...row, draft: JSON.parse(row.draft) as unknown })),
      assets: this.assets(actor),
    };
  }
  assets(actor: Actor) {
    requirePermission(actor, "pc:read");
    return this.store.database
      .prepare(
        "SELECT id,filename,content_type,bytes,checksum,created FROM media_assets ORDER BY created DESC",
      )
      .all();
  }
  asset(id: string, publicOnly = false) {
    if (!Identifier.safeParse(id).success) return null;
    if (
      publicOnly &&
      !this.store.snapshot().components.some((part) => part.images.includes(`/media/${id}`))
    )
      return null;
    return this.store.database.prepare("SELECT * FROM media_assets WHERE id = ?").get(id) as
      | { id: string; filename: string; content_type: string; bytes: number; checksum: string }
      | undefined;
  }
  save(
    actor: Actor,
    kind: string,
    id: string,
    value: unknown,
    expected: number,
    signal?: AbortSignal,
  ) {
    requirePermission(actor, "pc:write", signal);
    const db = this.store.database;
    return db.transaction(() => {
      const current = this.document(kind, id);
      if ((current?.revision ?? 0) !== expected) throw new AccessError("revision_conflict", 409);
      const next = expected + 1;
      db.prepare(
        "INSERT INTO admin_documents(kind,id,revision,draft) VALUES (?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET revision = excluded.revision,draft = excluded.draft",
      ).run(kind, id, next, JSON.stringify(value));
      audit(this.store, actor, `${kind}_saved`, id, next);
      return { id, revision: next };
    })();
  }
  current(kind: string, id: string, expected: number): Document {
    const row = this.document(kind, id);
    if (!row) throw new AccessError("not_found", 404);
    if (row.revision !== expected) throw new AccessError("revision_conflict", 409);
    return row;
  }
  preview(kind: string, id: string, expected: number): Snapshot {
    const document = this.current(kind, id, expected);
    const snapshot = this.store.snapshot();
    if (kind === "component") {
      const component = ComponentSchema.parse({
        ...JSON.parse(document.draft),
        status: "published",
      });
      snapshot.components = [...snapshot.components.filter((part) => part.id !== id), component];
    } else if (kind === "settings") {
      snapshot.settings = resolveSettings(
        mergeSettings(snapshot.settings, JSON.parse(document.draft)),
      );
    } else {
      snapshot.locales = LocaleOverridesSchema.parse({
        ...snapshot.locales,
        [id]: JSON.parse(document.draft),
      });
    }
    return snapshot;
  }
  publish(actor: Actor, kind: string, id: string, expected: number, signal?: AbortSignal) {
    requirePermission(actor, "pc:publish", signal);
    const db = this.store.database;
    return db.transaction(() => {
      const row = this.current(kind, id, expected);
      if (row.published_revision === row.revision) throw new AccessError("already_published", 409);
      const proposed = this.preview(kind, id, expected);
      if (kind === "component") {
        const component = proposed.components.find((part) => part.id === id)!;
        for (const offer of component.offers) {
          if (
            !Object.hasOwn(proposed.settings.markets, offer.market) ||
            offer.currency !== proposed.settings.markets[offer.market].currency
          )
            throw new AccessError("invalid_market_offer", 400);
        }
        for (const image of component.images.filter((value) => value.startsWith("/media/")))
          if (!this.asset(image.slice(7))) throw new AccessError("missing_asset", 400);
        this.store.replacePart(component);
      } else if (kind === "settings") {
        this.store.publishSettings(JSON.parse(row.draft));
      } else {
        db.prepare(
          "INSERT INTO published_locales(language,value) VALUES (?,?) ON CONFLICT(language) DO UPDATE SET value = excluded.value",
        ).run(id, row.draft);
      }
      signal?.throwIfAborted();
      db.prepare(
        "UPDATE admin_documents SET published_revision = revision WHERE kind = ? AND id = ?",
      ).run(kind, id);
      audit(this.store, actor, `${kind}_published`, id, expected);
      return { id, revision: expected };
    })();
  }
  execute(actor: Actor, operation: Operation, input: unknown, signal?: AbortSignal): unknown {
    const principal = this.store.database
      .prepare("SELECT role FROM auth_principals WHERE issuer = ? AND subject = ?")
      .get(actor.issuer, actor.subject) as { role: Role } | undefined;
    const session = this.store.database
      .prepare("SELECT hash FROM auth_sessions WHERE hash = ? AND expires > ?")
      .get(actor.sessionHash, Date.now());
    if (!principal || !session) throw new AccessError("not_authenticated", 401);
    if (
      actor.delegationHash &&
      !this.store.database
        .prepare("SELECT hash FROM auth_delegations WHERE hash = ? AND revoked = 0 AND expires > ?")
        .get(actor.delegationHash, Date.now())
    )
      throw new AccessError("not_authenticated", 401);
    actor = {
      ...actor,
      scopes: actor.scopes.filter((scope) => rolePermissions[principal.role].includes(scope)),
    };
    const definition = operationDefinitions[operation];
    if (!definition) throw new AccessError("not_found", 404);
    requirePermission(actor, definition.permission as Permission, signal);
    const data = definition.schema.parse(input) as Record<string, unknown>;
    switch (operation) {
      case "catalog_import":
        return this.store.database.transaction(() =>
          (data.components as Component[]).map((component) =>
            this.save(
              actor,
              "component",
              component.id,
              { ...component, status: "draft" },
              (data.expectedRevisions as Record<string, number>)[component.id] ?? 0,
              signal,
            ),
          ),
        )();
      case "catalog_list":
        return this.state(actor);
      case "assets_list":
        return this.assets(actor);
      case "audit_list":
        return this.store.database
          .prepare(
            "SELECT a.*,p.email,p.name FROM admin_audit a LEFT JOIN auth_principals p ON p.issuer = a.issuer AND p.subject = a.subject WHERE a.sequence > ? ORDER BY a.sequence DESC LIMIT 100",
          )
          .all(data.after);
      case "component_save": {
        const component = ComponentSchema.parse({
          ...(data.component as Component),
          status: "draft",
        });
        return this.save(
          actor,
          "component",
          component.id,
          component,
          data.expectedRevision as number,
          signal,
        );
      }
      case "settings_save": {
        resolveSettings(mergeSettings(this.store.snapshot().settings, data.value));
        return this.save(
          actor,
          "settings",
          "site",
          data.value,
          data.expectedRevision as number,
          signal,
        );
      }
      case "locale_save":
        return this.save(
          actor,
          "locale",
          data.language as string,
          data.value,
          data.expectedRevision as number,
          signal,
        );
      case "component_preview":
        return this.preview("component", data.id as string, data.revision as number);
      case "settings_preview":
        return this.preview("settings", "site", data.revision as number);
      case "locale_preview":
        return this.preview("locale", data.language as string, data.revision as number);
      case "component_publish":
        return this.publish(actor, "component", data.id as string, data.revision as number, signal);
      case "settings_publish":
        return this.publish(actor, "settings", "site", data.revision as number, signal);
      case "locale_publish":
        return this.publish(
          actor,
          "locale",
          data.language as string,
          data.revision as number,
          signal,
        );
      case "component_archive": {
        const id = data.id as string,
          expected = data.revision as number;
        return this.store.database.transaction(() => {
          if ((this.document("component", id)?.revision ?? 0) !== expected)
            throw new AccessError("revision_conflict", 409);
          const component = this.store.componentById(id);
          if (!component) throw new AccessError("not_found", 404);
          this.store.replacePart({ ...component, status: "archived" });
          const next = expected + 1;
          this.store.database
            .prepare(
              "INSERT INTO admin_documents(kind,id,revision,draft) VALUES ('component',?,?,?) ON CONFLICT(kind,id) DO UPDATE SET revision=excluded.revision,draft=excluded.draft",
            )
            .run(id, next, JSON.stringify({ ...component, status: "draft" }));
          audit(this.store, actor, "component_archived", id, next);
          return { id, revision: next };
        })();
      }
      case "asset_upload":
        return this.upload(actor, data.filename as string, data.base64 as string, signal);
    }
  }
  upload(actor: Actor, filename: string, base64: string, signal?: AbortSignal) {
    requirePermission(actor, "pc:write", signal);
    const bytes = Buffer.from(base64, "base64");
    if (bytes.toString("base64") !== base64 || bytes.length > 2 * 1024 * 1024 || !bytes.length)
      throw new AccessError("invalid_image", 400);
    const png =
      bytes.length >= 24 &&
      bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpeg = bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const webp =
      bytes.length >= 12 &&
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP";
    if (!png && !jpeg && !webp) throw new AccessError("invalid_image", 400);
    try {
      const dimensions = imageSize(bytes);
      if (
        !dimensions.width ||
        !dimensions.height ||
        dimensions.width > 8192 ||
        dimensions.height > 8192 ||
        dimensions.width * dimensions.height > 32000000
      )
        throw new Error("dimensions");
    } catch {
      throw new AccessError("invalid_image", 400);
    }
    const id = `asset-${randomUUID()}`,
      file = join(this.mediaDirectory, id);
    const contentType = png ? "image/png" : jpeg ? "image/jpeg" : "image/webp";
    signal?.throwIfAborted();
    writeFileSync(file, bytes, { flag: "wx", mode: 0o600 });
    try {
      this.store.database.transaction(() => {
        signal?.throwIfAborted();
        this.store.database
          .prepare(
            "INSERT INTO media_assets(id,filename,content_type,bytes,checksum,created) VALUES (?,?,?,?,?,?)",
          )
          .run(
            id,
            filename,
            contentType,
            bytes.length,
            createHash("sha256").update(bytes).digest("hex"),
            new Date().toISOString(),
          );
        audit(this.store, actor, "asset_uploaded", id);
      })();
    } catch (error) {
      rmSync(file, { force: true });
      throw error;
    }
    return { id, url: `/media/${id}`, contentType, bytes: bytes.length };
  }
}
