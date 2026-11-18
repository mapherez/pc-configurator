import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { once } from "node:events";
import { spawnSync } from "node:child_process";
import Database from "better-sqlite3";
import { CatalogStore } from "../src/db.js";
import { evaluateBuild, SnapshotSchema, type ComponentInput } from "@pc-configurator/domain";
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
  id: "test-component",
  sku: "TEST-1",
  name: "Test component",
  brand: "Example",
  category: "cpu",
  status: "published",
  offers: [{ market: "pt", currency: "EUR", netMinor: 12345, available: true }],
  specs: { socket: "AM5" },
} satisfies ComponentInput;
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
  edit
    .prepare(
      "UPDATE market_offers SET net_minor = 101 WHERE part_id = (SELECT id FROM catalog_parts WHERE slug = 'cpu-7600')",
    )
    .run();
  edit.prepare("DELETE FROM catalog_parts WHERE slug = 'cpu-13600k'").run();
  edit.close();
  const reopened = new CatalogStore(file);
  t.after(() => reopened.close());
  const parts = reopened.listParts();
  assert.equal(parts.length, 14);
  assert.equal(parts.find((part) => part.slug === component.id)?.price, "123.45");
  assert.equal(parts.find((part) => part.slug === "cpu-7600")?.price, "1.01");
  assert.ok(!parts.some((part) => part.slug === "cpu-13600k"));
});

void test("invalid prices and duplicate slugs cannot partially write categories", (t) => {
  const { file, store } = fixture(t);
  for (const netMinor of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() =>
      store.createPart({ ...component, offers: [{ ...component.offers[0], netMinor }] }),
    );
  }
  store.createPart(component);
  assert.throws(() => store.createPart({ ...component, category: "fan" }));
  assert.equal(store.listParts().length, 15);
  const db = new Database(file, { readonly: true });
  assert.equal(
    db.prepare("SELECT count(*) AS n FROM catalog_categories WHERE name = 'fan'").pluck().get(),
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

void test("public snapshot exposes published components only and quote matches the shared engine", async (t) => {
  const { store } = fixture(t);
  store.createPart({ ...component, id: "draft-cpu", status: "draft" });
  store.createPart({ ...component, id: "archived-cpu", status: "archived" });
  const base = await serve(t, store);
  const snapshot = SnapshotSchema.parse(await (await fetch(`${base}/api/configurator`)).json());
  assert.equal(snapshot.components.length, 14);
  assert.ok(snapshot.components.every((entry: { status: string }) => entry.status === "published"));
  const build = {
    version: 1 as const,
    market: "pt",
    language: "en-US" as const,
    lines: [{ slot: "cpu", componentId: "cpu-7800x3d", quantity: 1 }],
  };
  const response = await fetch(`${base}/api/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(build),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(
    await response.json(),
    evaluateBuild(build, snapshot.components, snapshot.settings),
  );
  for (const value of [
    { ...build, market: "missing" },
    { ...build, lines: [{ ...build.lines[0], quantity: 0 }] },
  ]) {
    assert.equal(
      (
        await fetch(`${base}/api/quote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(value),
        })
      ).status,
      400,
    );
  }
  assert.equal(
    (
      await fetch(`${base}/api/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      })
    ).status,
    400,
  );
});

void test("published market settings persist without overwriting independent defaults or prices", (t) => {
  const { store, file } = fixture(t);
  store.publishSettings({
    markets: { pt: { taxBasisPoints: 600 }, us: { taxBasisPoints: null } },
    global: { features: { exampleBuild: false } },
  });
  assert.throws(() => store.publishSettings({ markets: { pt: { taxBasisPoints: -1 } } }));
  store.close();
  const reopened = new CatalogStore(file);
  t.after(() => reopened.close());
  const snapshot = reopened.snapshot();
  assert.equal(snapshot.settings.markets.pt.taxBasisPoints, 600);
  assert.equal(snapshot.settings.markets.us.taxBasisPoints, null);
  assert.equal(snapshot.settings.global.features.exampleBuild, false);
  assert.equal(snapshot.settings.global.features.priceFilter, true);
  assert.equal(snapshot.components[0].offers[0].netMinor, 39999);
});

void test("existing local catalogues retain edited prices and removals when their structure is prepared", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "pc-existing-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = join(directory, "catalog.db");
  const db = new Database(file);
  db.exec(`
    PRAGMA application_id = 1346586183; PRAGMA user_version = 1;
    CREATE TABLE catalog_categories (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE) STRICT;
    CREATE TABLE catalog_parts (id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, sku TEXT NOT NULL, name TEXT NOT NULL, brand TEXT NOT NULL, net_minor INTEGER NOT NULL CHECK(net_minor >= 0), category_id INTEGER NOT NULL REFERENCES catalog_categories(id), images TEXT NOT NULL CHECK(json_valid(images)), specs TEXT NOT NULL CHECK(json_valid(specs))) STRICT;
    INSERT INTO catalog_categories VALUES (1, 'cpu');
    INSERT INTO catalog_parts VALUES (20, 'my-custom-cpu', 'CUSTOM', 'My CPU', 'Example', 12345, 1, '[]', '{}');
  `);
  db.close();
  const store = new CatalogStore(file);
  t.after(() => store.close());
  assert.equal(store.snapshot().components.length, 1);
  assert.equal(store.snapshot().components[0].id, "my-custom-cpu");
  assert.equal(store.snapshot().components[0].offers[0].netMinor, 12345);
  assert.equal(store.listParts()[0].id, 20);
});
