import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";

void test("one-shot Auth setup registers exact callbacks, persists its secret and refuses silent origin changes", async (t) => {
  const directory = mkdtempSync("/tmp/pc-auth-setup-"),
    socket = join(directory, "admin.sock");
  const registrations: { client_secret: string; redirect_uris: string[]; suite_logout: boolean }[] =
    [];
  const server = createServer((req, res) => {
    void (async () => {
      assert.equal(req.method, "PUT");
      assert.equal(req.url, "/v1/clients/pc-configurator");
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const data = JSON.parse(
        Buffer.concat(chunks).toString("utf8"),
      ) as (typeof registrations)[number];
      registrations.push(data);
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          client_id: "pc-configurator",
          redirect_uris: data.redirect_uris,
          suite_logout: false,
        }),
      );
    })().catch(() => res.writeHead(500).end());
  });
  server.listen(socket);
  await once(server, "listening");
  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(directory, { recursive: true, force: true });
  });
  const run = async (publicOrigin = "http://pc.home.arpa") => {
    const child = spawn(process.execPath, ["dist/src/auth-setup.js"], {
      env: {
        ...process.env,
        PC_CONFIGURATOR_DATA_DIR: directory,
        NOX_AUTH_PUBLIC_URL: "https://auth.example.test",
        PC_CONFIGURATOR_PUBLIC_URL: publicOrigin,
        NOX_AUTH_ADMIN_SOCKET: socket,
      },
      stdio: "pipe",
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      output += String(chunk);
    });
    const [code] = await once(child, "exit");
    return { code, output };
  };
  assert.equal((await run()).code, 0);
  const path = join(directory, "nox-login.json"),
    first = JSON.parse(readFileSync(path, "utf8")) as { clientSecret: string };
  assert.ok(first.clientSecret.length >= 43);
  assert.equal(statSync(path).mode & 0o777, 0o600);
  const repeated = await run();
  assert.equal(repeated.code, 0);
  assert.ok(!repeated.output.includes(first.clientSecret));
  assert.equal(registrations[1].client_secret, registrations[0].client_secret);
  assert.deepEqual(registrations[0].redirect_uris, ["http://pc.home.arpa/auth/nox/callback"]);
  assert.equal(registrations[0].suite_logout, false);
  assert.notEqual((await run("http://other.home.arpa")).code, 0);
  assert.equal(registrations.length, 2);
});
