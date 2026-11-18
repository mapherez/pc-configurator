import { once } from "node:events";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { authFixture } from "./auth-fixture.js";
import { ManagementService } from "../src/management/service.js";
import { AdminAuth } from "../src/management/auth.js";
import { digest } from "../src/nox-login.js";

const both = "application/json, text/event-stream";
void test("login validates browser binding, state, nonce, signature, audience, at_hash and single-use callback", async (t) => {
  const fixture = await authFixture(t);
  const begun = await fixture.start();
  const query = fixture.authorize(begun.url);
  const missingBrowser = await fetch(`${fixture.base}/auth/nox/callback?${query.toString()}`, {
    redirect: "manual",
  });
  assert.match(missingBrowser.headers.get("location")!, /error=login_denied/);
  const response = await fetch(`${fixture.base}/auth/nox/callback?${query.toString()}`, {
    redirect: "manual",
    headers: { Cookie: begun.cookie },
  });
  assert.equal(response.headers.get("location"), "/admin");
  assert.ok(
    response.headers
      .getSetCookie()
      .some((value) => /pc_admin_session=.*HttpOnly.*SameSite=Lax/i.test(value)),
  );
  const replay = await fetch(`${fixture.base}/auth/nox/callback?${query.toString()}`, {
    redirect: "manual",
    headers: { Cookie: begun.cookie },
  });
  assert.match(replay.headers.get("location")!, /error=login_denied/);
  for (const flag of ["badNonce", "badAudience", "badHash", "badSignature"] as const) {
    fixture.controls[flag] = true;
    const transaction = await fixture.start();
    const result = await fetch(
      `${fixture.base}/auth/nox/callback?${fixture.authorize(transaction.url).toString()}`,
      { redirect: "manual", headers: { Cookie: transaction.cookie } },
    );
    assert.match(result.headers.get("location")!, /error=login_denied/, flag);
    assert.ok(
      !result.headers.getSetCookie().some((value) => value.startsWith("pc_admin_session=")),
      flag,
    );
    fixture.controls[flag] = false;
  }
  const wrongState = await fixture.start(),
    altered = fixture.authorize(wrongState.url);
  altered.set("state", "wrong");
  assert.match(
    (
      await fetch(`${fixture.base}/auth/nox/callback?${altered.toString()}`, {
        redirect: "manual",
        headers: { Cookie: wrongState.cookie },
      })
    ).headers.get("location")!,
    /error=login_denied/,
  );
});

void test("private API enforces authentication, origin, CSRF, roles and optimistic publication without leaking credentials", async (t) => {
  const f = await authFixture(t),
    owner = await f.signIn();
  assert.equal(owner.session.actor.role, "owner");
  assert.equal((await fetch(`${f.base}/api/admin/state`)).status, 401);
  const headers = {
    Cookie: owner.cookie,
    Origin: f.base,
    "X-CSRF-Token": owner.csrf,
    "Content-Type": "application/json",
  };
  const call = (operation: string, input: unknown, overrides: Record<string, string> = {}) =>
    fetch(`${f.base}/api/admin/execute`, {
      method: "POST",
      headers: { ...headers, ...overrides },
      body: JSON.stringify({ operation, input }),
    });
  const part = { ...f.store.snapshot().components[0], name: "New draft name" };
  assert.equal(
    (
      await call(
        "component_save",
        { component: part, expectedRevision: 0 },
        { Origin: "https://attacker.test" },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        "component_save",
        { component: part, expectedRevision: 0 },
        { "X-CSRF-Token": "bad" },
      )
    ).status,
    403,
  );
  assert.equal(
    (await call("component_save", { component: part, expectedRevision: 0 })).status,
    200,
  );
  assert.notEqual(f.store.snapshot().components[0].name, part.name);
  assert.equal(
    (await call("component_save", { component: part, expectedRevision: 0 })).status,
    409,
  );
  const preview = await call("component_preview", { id: part.id, revision: 1 });
  assert.equal(
    (
      (await preview.json()) as { result: { components: { name: string }[] } }
    ).result.components.find((entry) => entry.name === part.name)?.name,
    part.name,
  );
  assert.equal((await call("component_publish", { id: part.id, revision: 1 })).status, 200);
  assert.equal(f.store.snapshot().components[0].name, part.name);
  assert.equal((await call("component_publish", { id: part.id, revision: 1 })).status, 409);
  const colleague = await f.signIn({
    ...f.owner,
    sub: "editor-subject",
    email: "editor@example.test",
    google_sub: "google-editor",
  });
  assert.equal(colleague.session.actor.role, "unassigned");
  assert.equal(
    (await fetch(`${f.base}/api/admin/state`, { headers: { Cookie: colleague.cookie } })).status,
    403,
  );
  f.store.database
    .prepare("UPDATE auth_principals SET role = 'editor' WHERE subject = 'editor-subject'")
    .run();
  const forbidden = await call(
    "component_archive",
    { id: part.id, revision: 1 },
    { Cookie: colleague.cookie, "X-CSRF-Token": colleague.csrf },
  );
  assert.equal(forbidden.status, 403);
  const state = await (await fetch(`${f.base}/api/admin/state`, { headers })).text();
  assert.ok(
    !state.includes("accessToken") &&
      !state.includes("clientSecret") &&
      !state.includes("credential"),
  );
  assert.equal((await call("component_archive", { id: part.id, revision: 1 })).status, 200);
  assert.ok(!f.store.snapshot().components.some((entry) => entry.id === part.id));
});

void test("admission cache expires within five minutes, fails closed on outages, and never resurrects a revoked session", async (t) => {
  const f = await authFixture(t),
    owner = await f.signIn();
  const read = () => fetch(`${f.base}/api/admin/state`, { headers: { Cookie: owner.cookie } });
  assert.equal((await read()).status, 200);
  assert.equal(f.controls.introspections, 1);
  const now = Date.now();
  t.mock.method(Date, "now", () => now + 300001);
  f.controls.available = false;
  assert.equal((await read()).status, 503);
  assert.equal((await read()).status, 503);
  f.controls.available = true;
  f.controls.active = false;
  assert.equal((await read()).status, 401);
  f.controls.active = true;
  assert.equal((await read()).status, 401);
});

void test("MCP uses the installed NoX SDK, filters discovery, shares drafts/publication and revokes live access", async (t) => {
  const f = await authFixture(t),
    owner = await f.signIn();
  const auth = new AdminAuth(f.store, f.login, f.owner.email);
  const actor = await auth.session(digest(owner.cookie.split("=")[1]));
  const readToken = auth.createDelegation(actor, {
    name: "Read only",
    scopes: ["pc:read"],
    hours: 1,
  });
  const writeToken = auth.createDelegation(actor, {
    name: "Write and publish",
    scopes: ["pc:read", "pc:write", "pc:publish"],
    hours: 1,
  });
  const mcp = async (token: string, method: string, params: unknown = {}) =>
    fetch(`${f.base}/mcp`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: both,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
  assert.equal((await fetch(`${f.base}/mcp`, { method: "POST" })).status, 401);
  const init = await mcp(readToken.token, "initialize", {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "test", version: "1" },
  });
  assert.equal(init.status, 200);
  const listed = (await (await mcp(readToken.token, "tools/list")).json()) as {
    result: { tools: { name: string }[] };
  };
  assert.ok(listed.result.tools.some((tool) => tool.name === "pc_component_preview"));
  assert.ok(!listed.result.tools.some((tool) => tool.name === "pc_component_publish"));
  const writable = (await (await mcp(writeToken.token, "tools/list")).json()) as {
    result?: { tools: { name: string; inputSchema: unknown }[] };
  };
  assert.ok(
    writable.result?.tools.some((tool) => tool.name === "pc_settings_save"),
    JSON.stringify(writable),
  );
  assert.ok(
    writable.result?.tools.some((tool) => tool.name === "pc_locale_save"),
    JSON.stringify(writable),
  );
  const component = { ...f.store.snapshot().components[0], name: "MCP draft" };
  const saved = (await (
    await mcp(writeToken.token, "tools/call", {
      name: "pc_component_save",
      arguments: { component, expectedRevision: 0 },
    })
  ).json()) as { result: { isError?: boolean } };
  assert.ok(!saved.result.isError, JSON.stringify(saved));
  assert.notEqual(f.store.snapshot().components[0].name, "MCP draft");
  const published = (await (
    await mcp(writeToken.token, "tools/call", {
      name: "pc_component_publish",
      arguments: { id: component.id, revision: 1 },
    })
  ).json()) as { result: { isError?: boolean } };
  assert.ok(!published.result.isError, JSON.stringify(published));
  assert.equal(f.store.snapshot().components[0].name, "MCP draft");
  auth.revokeDelegation(actor, writeToken.id);
  assert.equal((await mcp(writeToken.token, "tools/list")).status, 401);
  const audit = f.store.database.prepare("SELECT * FROM admin_audit WHERE channel = 'mcp'").all();
  assert.equal(audit.length, 2);
  assert.ok(!JSON.stringify(audit).includes(writeToken.token));
  await auth.logout(actor);
  assert.equal((await mcp(readToken.token, "tools/list")).status, 401);
});

void test("settings/locales publish explicitly, images stay private until publication, and cancellation rolls back mutations", async (t) => {
  const f = await authFixture(t),
    owner = await f.signIn();
  const actor = await new AdminAuth(f.store, f.login, f.owner.email).session(
    digest(owner.cookie.split("=")[1]),
  );
  const service = new ManagementService(f.store, f.directory);
  const run = (operation: Parameters<ManagementService["execute"]>[1], input: unknown) =>
    service.execute(actor, operation, input);
  run("settings_save", {
    value: { markets: { pt: { taxBasisPoints: 600 } } },
    expectedRevision: 0,
  });
  assert.equal(f.store.snapshot().settings.markets.pt.taxBasisPoints, 2300);
  assert.equal(
    (
      run("settings_preview", { revision: 1 }) as {
        settings: { markets: { pt: { taxBasisPoints: number } } };
      }
    ).settings.markets.pt.taxBasisPoints,
    600,
  );
  run("settings_publish", { revision: 1 });
  assert.equal(f.store.snapshot().settings.markets.pt.taxBasisPoints, 600);
  run("locale_save", {
    language: "pt-PT",
    value: { title: "A tua montagem" },
    expectedRevision: 0,
  });
  assert.equal(f.store.snapshot().locales?.["pt-PT"]?.title, undefined);
  run("locale_publish", { language: "pt-PT", revision: 1 });
  assert.equal(f.store.snapshot().locales?.["pt-PT"]?.title, "A tua montagem");
  assert.throws(() =>
    run("locale_save", {
      language: "pt-PT",
      value: { progress: "Sem parâmetros" },
      expectedRevision: 1,
    }),
  );
  const image =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aYWQAAAAASUVORK5CYII=";
  const asset = run("asset_upload", { filename: "pixel.png", base64: image }) as {
    id: string;
    url: string;
  };
  assert.deepEqual(
    readFileSync(join(service.mediaDirectory, asset.id)),
    Buffer.from(image, "base64"),
  );
  assert.equal((await fetch(f.base + asset.url)).status, 404);
  const component = { ...f.store.snapshot().components[0], images: [asset.url] };
  run("component_save", { component, expectedRevision: 0 });
  run("component_publish", { id: component.id, revision: 1 });
  assert.equal((await fetch(f.base + asset.url)).status, 200);
  assert.throws(() =>
    run("asset_upload", {
      filename: "script.svg",
      base64: Buffer.from("<svg onload='alert(1)'/>").toString("base64"),
    }),
  );
  const abort = new AbortController();
  abort.abort();
  assert.throws(() =>
    service.execute(actor, "component_archive", { id: component.id, revision: 1 }, abort.signal),
  );
  assert.equal(f.store.componentById(component.id)!.status, "published");
});

void test("MCP 2026 discovery cannot gain tools from untrusted metadata and expired delegations fail before execution", async (t) => {
  const f = await authFixture(t),
    owner = await f.signIn();
  const auth = new AdminAuth(f.store, f.login, f.owner.email);
  const actor = await auth.session(digest(owner.cookie.split("=")[1]));
  const token = auth.createDelegation(actor, {
    name: "Modern read",
    scopes: ["pc:read"],
    hours: 1,
  });
  const response = await fetch(`${f.base}/mcp`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.token}`,
      "Content-Type": "application/json",
      Accept: both,
      "MCP-Protocol-Version": "2026-07-28",
      "MCP-Method": "tools/list",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 10,
      method: "tools/list",
      params: {
        _meta: {
          "io.modelcontextprotocol/protocolVersion": "2026-07-28",
          "io.modelcontextprotocol/clientInfo": { name: "test", version: "1" },
          "io.modelcontextprotocol/clientCapabilities": {},
          authInfo: { scopes: ["pc:publish", "pc:admin"] },
        },
      },
    }),
  });
  assert.equal(response.status, 200);
  const body = (await response.json()) as { result: { tools: { name: string }[] } };
  assert.ok(!body.result.tools.some((tool) => tool.name === "pc_component_publish"));
  const now = Date.now();
  t.mock.method(Date, "now", () => now + 3600001);
  assert.equal(
    (
      await fetch(`${f.base}/mcp`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token.token}` },
      })
    ).status,
    401,
  );
});

void test("catalogue import is atomic, creates only drafts and detects concurrent edits", async (t) => {
  const f = await authFixture(t),
    owner = await f.signIn();
  const actor = await new AdminAuth(f.store, f.login, f.owner.email).session(
    digest(owner.cookie.split("=")[1]),
  );
  const service = new ManagementService(f.store, f.directory);
  const parts = f.store
    .snapshot()
    .components.slice(0, 2)
    .map((part) => ({ ...part, name: `${part.name} imported` }));
  service.execute(actor, "component_save", { component: parts[1], expectedRevision: 0 });
  assert.throws(() =>
    service.execute(actor, "catalog_import", { components: parts, expectedRevisions: {} }),
  );
  assert.equal(
    service.document("component", parts[0].id),
    undefined,
    "first change rolls back when the next revision conflicts",
  );
  service.execute(actor, "catalog_import", {
    components: parts,
    expectedRevisions: { [parts[1].id]: 1 },
  });
  assert.equal(service.document("component", parts[0].id)?.revision, 1);
  assert.equal(f.store.snapshot().components[0].name.endsWith("imported"), false);
});

void test("content backups preserve roles and audits but never restore browser or MCP credentials", async (t) => {
  const { spawn } = await import("node:child_process"),
    { default: Database } = await import("better-sqlite3");
  const f = await authFixture(t),
    owner = await f.signIn();
  const auth = new AdminAuth(f.store, f.login, f.owner.email),
    actor = await auth.session(digest(owner.cookie.split("=")[1]));
  auth.createDelegation(actor, { name: "Do not restore", scopes: ["pc:read"], hours: 1 });
  const destination = join(f.directory, "content-backup.db");
  const child = spawn(process.execPath, ["dist/src/backup.js", destination], {
    env: { ...process.env, PC_CONFIGURATOR_DATA_DIR: f.directory },
    stdio: "pipe",
  });
  let error = "";
  child.stderr.on("data", (chunk) => {
    error += String(chunk);
  });
  const [code] = await once(child, "exit");
  assert.equal(code, 0, error);
  const db = new Database(destination, { readonly: true });
  t.after(() => db.close());
  assert.equal(db.prepare("SELECT count(*) FROM auth_sessions").pluck().get(), 0);
  assert.equal(db.prepare("SELECT count(*) FROM auth_delegations").pluck().get(), 0);
  assert.equal(db.prepare("SELECT count(*) FROM auth_principals").pluck().get(), 1);
  assert.equal(db.prepare("SELECT count(*) FROM admin_audit").pluck().get(), 1);
  assert.equal(f.store.database.prepare("SELECT count(*) FROM auth_sessions").pluck().get(), 1);
});

void test("renewed browser login returns to its bound local path and retires previous session delegations", async (t) => {
  const f = await authFixture(t),
    first = await f.signIn();
  const auth = new AdminAuth(f.store, f.login, f.owner.email);
  const actor = await auth.session(digest(first.cookie.split("=")[1]));
  auth.createDelegation(actor, { name: "Old session", scopes: ["pc:read"], hours: 1 });
  const start = await fetch(
    `${f.base}/auth/nox/start?return_to=${encodeURIComponent("/admin/preview?kind=settings&id=site&revision=1")}`,
    { method: "POST", headers: { Origin: f.base }, redirect: "manual" },
  );
  const transaction = start.headers
    .getSetCookie()
    .find((value) => value.startsWith("pc_login_transaction="))!
    .split(";")[0];
  const result = await fetch(
    `${f.base}/auth/nox/callback?${f.authorize(start.headers.get("location")!).toString()}`,
    { redirect: "manual", headers: { Cookie: `${transaction}; ${first.cookie}` } },
  );
  assert.equal(result.headers.get("location"), "/admin/preview?kind=settings&id=site&revision=1");
  assert.equal(f.store.database.prepare("SELECT count(*) FROM auth_delegations").pluck().get(), 0);
  assert.equal(
    (await fetch(`${f.base}/api/admin/state`, { headers: { Cookie: first.cookie } })).status,
    401,
  );
  const bad = await fetch(
    `${f.base}/auth/nox/start?return_to=${encodeURIComponent("//evil.example/admin")}`,
    { method: "POST", headers: { Origin: f.base }, redirect: "manual" },
  );
  assert.equal(bad.status, 400);
});

void test("owner bootstrap recovers after correcting the configured email before any owner exists", async (t) => {
  const f = await authFixture(t);
  const identity = {
    ...f.owner,
    sub: "future-owner",
    email: "corrected@example.test",
    google_sub: "google-corrected",
  };
  assert.equal((await f.signIn(identity)).session.actor.role, "unassigned");
  const corrected = new AdminAuth(f.store, f.login, identity.email);
  const begun = corrected.start();
  const completed = await corrected.complete(begun.browser, f.authorize(begun.url, identity));
  const actor = await corrected.session(digest(completed.raw));
  assert.equal(actor.role, "owner");
});
