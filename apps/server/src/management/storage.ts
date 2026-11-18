import type { CatalogStore } from "../db.js";

export function prepareManagement(store: CatalogStore) {
  store.database.exec(`
    CREATE TABLE IF NOT EXISTS auth_principals (
      issuer TEXT NOT NULL, subject TEXT NOT NULL, email TEXT NOT NULL, name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('unassigned','viewer','editor','publisher','owner')),
      PRIMARY KEY(issuer, subject)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS auth_transactions (
      hash TEXT PRIMARY KEY, state TEXT NOT NULL, nonce TEXT NOT NULL, verifier TEXT NOT NULL,
      created INTEGER NOT NULL, expires INTEGER NOT NULL, return_path TEXT NOT NULL DEFAULT '/admin'
    ) STRICT;
    CREATE TABLE IF NOT EXISTS auth_sessions (
      hash TEXT PRIMARY KEY, issuer TEXT NOT NULL, subject TEXT NOT NULL, credential TEXT NOT NULL,
      expires INTEGER NOT NULL, renew_at INTEGER NOT NULL, csrf TEXT NOT NULL, created INTEGER NOT NULL,
      FOREIGN KEY(issuer,subject) REFERENCES auth_principals(issuer,subject)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS auth_delegations (
      hash TEXT PRIMARY KEY, id TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      session_hash TEXT NOT NULL REFERENCES auth_sessions(hash) ON DELETE CASCADE,
      scopes TEXT NOT NULL, expires INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0
    ) STRICT;
    CREATE TABLE IF NOT EXISTS admin_documents (
      kind TEXT NOT NULL, id TEXT NOT NULL, revision INTEGER NOT NULL, draft TEXT NOT NULL,
      published_revision INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(kind,id)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS admin_audit (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT, occurred TEXT NOT NULL,
      issuer TEXT NOT NULL, subject TEXT NOT NULL, channel TEXT NOT NULL,
      action TEXT NOT NULL, target TEXT NOT NULL, revision INTEGER NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS published_locales (
      language TEXT PRIMARY KEY, value TEXT NOT NULL CHECK(json_valid(value))
    ) STRICT;
    CREATE TABLE IF NOT EXISTS media_assets (
      id TEXT PRIMARY KEY, filename TEXT NOT NULL, content_type TEXT NOT NULL,
      bytes INTEGER NOT NULL, checksum TEXT NOT NULL, created TEXT NOT NULL
    ) STRICT;
  `);
  if (
    !(
      store.database.prepare("PRAGMA table_info(auth_transactions)").all() as { name: string }[]
    ).some((column) => column.name === "return_path")
  )
    store.database.exec(
      "ALTER TABLE auth_transactions ADD COLUMN return_path TEXT NOT NULL DEFAULT '/admin'",
    );
}
export const permissions = ["pc:read", "pc:write", "pc:publish", "pc:admin"] as const;
export type Permission = (typeof permissions)[number];
export type Role = "unassigned" | "viewer" | "editor" | "publisher" | "owner";
export const rolePermissions: Record<Role, readonly Permission[]> = {
  unassigned: [],
  viewer: ["pc:read"],
  editor: ["pc:read", "pc:write"],
  publisher: ["pc:read", "pc:write", "pc:publish"],
  owner: permissions,
};
export type Actor = {
  issuer: string;
  subject: string;
  email: string;
  name: string;
  role: Role;
  scopes: readonly Permission[];
  channel: "web" | "mcp";
  sessionHash: string;
  delegationHash?: string;
  csrf?: string;
};
export class AccessError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 403,
  ) {
    super(code);
  }
}
export function requirePermission(actor: Actor, permission: Permission, signal?: AbortSignal) {
  signal?.throwIfAborted();
  if (!actor.scopes.includes(permission)) throw new AccessError("forbidden");
}
export function audit(
  store: CatalogStore,
  actor: Actor,
  action: string,
  target: string,
  revision = 0,
) {
  store.database
    .prepare(
      "INSERT INTO admin_audit(occurred,issuer,subject,channel,action,target,revision) VALUES (?,?,?,?,?,?,?)",
    )
    .run(
      new Date().toISOString(),
      actor.issuer,
      actor.subject,
      actor.channel,
      action,
      target,
      revision,
    );
}
