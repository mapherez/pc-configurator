import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";

const image = process.argv[2] ?? "pc-configurator:local";
const name = `pc-check-${randomUUID()}`;
const volume = `${name}-data`;
let volumeCreated = false;
let containerCreated = false;
function docker(...args) {
  return execFileSync("docker", args, { encoding: "utf8", timeout: 60_000 }).trim();
}
async function start() {
  docker(
    "run",
    "--detach",
    "--name",
    name,
    "--read-only",
    "--tmpfs",
    "/tmp",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges:true",
    "--volume",
    `${volume}:/data`,
    "--publish",
    "127.0.0.1::8080",
    image,
  );
  containerCreated = true;
  return await ready();
}
async function ready() {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (docker("inspect", "--format", "{{.State.Running}}", name) !== "true") {
      throw new Error(`Container exited during startup:\n${docker("logs", name)}`);
    }
    const ports = JSON.parse(
      docker("inspect", "--format", "{{json .NetworkSettings.Ports}}", name),
    );
    const port = ports["8080/tcp"]?.[0]?.HostPort;
    if (port) {
      const base = `http://127.0.0.1:${port}`;
      try {
        const response = await fetch(`${base}/health`, { signal: AbortSignal.timeout(1000) });
        if (response.ok) return base;
      } catch {
        /* Process starting. */
      }
    }
    await setTimeout(500);
  }
  throw new Error(`Container did not become ready:\n${docker("logs", name)}`);
}
async function count(base) {
  const response = await fetch(`${base}/api/parts`);
  assert.equal(response.status, 200);
  return (await response.json()).length;
}
function stop() {
  docker("stop", "--timeout", "15", name);
  assert.equal(docker("inspect", "--format", "{{.State.ExitCode}}", name), "0", "clean shutdown");
  docker("rm", name);
  containerCreated = false;
}
try {
  docker("volume", "create", volume);
  volumeCreated = true;
  let base = await start();
  assert.equal(await count(base), 14);
  for (const path of ["/", "/prototype.html"]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.ok(html.includes('id="root"'));
    for (const asset of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) {
      assert.equal((await fetch(base + asset[1])).status, 200, asset[1]);
    }
  }
  assert.equal((await fetch(`${base}/api/parts`, { method: "POST" })).status, 405);
  assert.equal((await fetch(`${base}/api/missing`)).status, 404);
  docker(
    "exec",
    name,
    "node",
    "--input-type=module",
    "-e",
    `
    import { CatalogStore } from './dist/src/db.js';
    const store = new CatalogStore('/data/catalog.db');
    store.createPart({slug:'persistent-test', sku:'TEST', name:'Test', brand:'Test', category:'cpu', netMinor:123});
    store.close();
  `,
  );
  docker("exec", name, "node", "dist/src/backup.js", "/data/check-backup.db");
  docker("restart", "--timeout", "15", name);
  base = await ready();
  assert.equal(await count(base), 15);
  stop();
  base = await start();
  assert.equal(await count(base), 15, "data survives replacement of the container");
  stop();
  console.log("Container checks passed: assets, API, backup, restart, replacement and shutdown.");
} finally {
  if (containerCreated) docker("rm", "--force", name);
  if (volumeCreated) docker("volume", "rm", volume);
}
