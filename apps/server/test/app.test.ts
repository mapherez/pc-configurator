import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { once } from "node:events";
import { spawnSync } from "node:child_process";
import Database from "better-sqlite3";
import { CatalogStore } from "../src/db.js";
import { createApp } from "../src/app.js";

function fixture(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), "pc-catalog-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = join(directory, "catalog.db");
  const store = new CatalogStore(file);
  t.after(() => store.close());
  return { directory, file, store };
}
const component = {
  slug: "test-component",
  sku: "TEST-1",
  name: "Test component",
  brand: "Example",
  category: "cpu",
  netMinor: 12345,
  specs: { socket: "AM5" },
};
async function serve(t: TestContext, store: CatalogStore, webDir?: string) {
  const server = createApp(store, webDir).listen(0, "127.0.0.1");
  t.after(
    () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  );
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No TCP address");
  return `http://127.0.0.1:${address.port}`;
}

void test("first start creates the catalogue atomically; restarts preserve additions, edits and deletions", (t) => {
  const { file, store } = fixture(t);
  assert.equal(store.listParts().length, 14);
  store.createPart(component);
  store.close();
  const edit = new Database(file);
  edit.prepare("UPDATE catalog_parts SET net_minor = 101 WHERE slug = 'cpu-7600'").run();
  edit.prepare("DELETE FROM catalog_parts WHERE slug = 'cpu-13600k'").run();
  edit.close();
  const reopened = new CatalogStore(file);
  t.after(() => reopened.close());
  const parts = reopened.listParts();
  assert.equal(parts.length, 14);
  assert.equal(parts.find((part) => part.slug === component.slug)?.price, "123.45");
  assert.equal(parts.find((part) => part.slug === "cpu-7600")?.price, "1.01");
  assert.ok(!parts.some((part) => part.slug === "cpu-13600k"));
});

void test("invalid prices and duplicate slugs cannot partially write categories", (t) => {
  const { file, store } = fixture(t);
  for (const netMinor of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => store.createPart({ ...component, netMinor }));
  }
  store.createPart(component);
  assert.throws(() => store.createPart({ ...component, category: "unwanted-category" }));
  assert.equal(store.listParts().length, 15);
  const db = new Database(file, { readonly: true });
  assert.equal(
    db
      .prepare("SELECT count(*) AS n FROM catalog_categories WHERE name = 'unwanted-category'")
      .pluck()
      .get(),
    0,
  );
  db.close();
});

void test("unrecognized databases are rejected without replacing their data", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "pc-unknown-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = join(directory, "catalog.db");
  const db = new Database(file);
  db.exec("CREATE TABLE precious (value TEXT); INSERT INTO precious VALUES ('keep')");
  db.close();
  assert.throws(() => new CatalogStore(file), /Unrecognized/);
  const check = new Database(file);
  assert.equal(check.prepare("SELECT value FROM precious").pluck().get(), "keep");
  assert.equal(
    check.prepare("SELECT count(*) FROM sqlite_master WHERE name = 'catalog_parts'").pluck().get(),
    0,
  );
  check.close();
});

void test("real HTTP API reads SQLite, blocks public writes and reports database readiness", async (t) => {
  const { store } = fixture(t);
  const base = await serve(t, store);
  assert.deepEqual(await (await fetch(`${base}/health`)).json(), { ok: true });
  const response = await fetch(`${base}/api/parts`);
  const parts = (await response.json()) as { price: string; category: { name: string } }[];
  assert.equal(parts.length, 14);
  assert.equal(parts[0].price, "399.99");
  assert.equal(parts[0].category.name, "cpu");
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const result = await fetch(`${base}/api/parts`, { method, body: "{}" });
    assert.equal(result.status, 405);
    assert.equal(result.headers.get("allow"), "GET, HEAD");
  }
  assert.equal((await fetch(`${base}/api/missing`)).status, 404);
  store.close();
  assert.equal((await fetch(`${base}/health`)).status, 503);
});

void test("web, prototype and API share an origin; missing assets and API routes are not HTML", async (t) => {
  const { store, directory } = fixture(t);
  const web = join(directory, "web");
  mkdirSync(web);
  writeFileSync(join(web, "index.html"), "<h1>App</h1>");
  writeFileSync(join(web, "prototype.html"), "<h1>Prototype</h1>");
  const base = await serve(t, store, web);
  for (const path of ["/", "/en/build"])
    assert.equal(await (await fetch(base + path)).text(), "<h1>App</h1>");
  assert.equal(await (await fetch(`${base}/prototype.html`)).text(), "<h1>Prototype</h1>");
  assert.equal((await fetch(`${base}/missing.js`)).status, 404);
  assert.equal((await fetch(`${base}/api/missing`)).status, 404);
  assert.throws(() => createApp(store, join(directory, "missing")), /Build the frontend/);
});

void test("online backup captures WAL changes, restores and refuses to overwrite a file", (t) => {
  const { store, directory } = fixture(t);
  store.createPart(component);
  const destination = join(directory, "backup.db");
  const run = () =>
    spawnSync(process.execPath, ["dist/src/backup.js", destination], {
      encoding: "utf8",
      env: { ...process.env, PC_CONFIGURATOR_DATA_DIR: directory },
    });
  const first = run();
  assert.equal(first.status, 0, first.stderr);
  assert.notEqual(run().status, 0);
  const restored = new CatalogStore(destination);
  t.after(() => restored.close());
  assert.deepEqual(restored.listParts(), store.listParts());
  const db = new Database(destination, { readonly: true });
  assert.equal(db.pragma("integrity_check", { simple: true }), "ok");
  db.close();
});
