import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { CatalogStore } from "../src/db.js";
import { createApp } from "../src/app.js";
import { NoXLogin, secret, type Identity } from "../src/nox-login.js";
import type { TestContext } from "node:test";

export async function authFixture(t?: TestContext, options: { webDir?: string } = {}) {
  const directory = mkdtempSync("/tmp/pc-admin-test-");
  const store = new CatalogStore(join(directory, "catalog.db"));
  const http = createServer();
  http.listen(0, "127.0.0.1");
  await once(http, "listening");
  const address = http.address();
  if (!address || typeof address === "string") throw new Error("No HTTP address");
  const base = `http://127.0.0.1:${address.port}`;
  const config = {
    issuer: "https://auth.example.test",
    publicOrigin: base,
    clientId: "pc-configurator" as const,
    clientSecret: secret(),
  };
  const keys = await generateKeyPair("ES256"),
    otherKeys = await generateKeyPair("ES256");
  const jwk = { ...(await exportJWK(keys.publicKey)), kid: "fixture", alg: "ES256", use: "sig" };
  const controls = {
    active: true,
    available: true,
    introspections: 0,
    badNonce: false,
    badAudience: false,
    badHash: false,
    badSignature: false,
  };
  const codes = new Map<string, { nonce: string; challenge: string; identity: Identity }>();
  const credentials = new Map<string, { identity: Identity; expires: number }>();
  const provider = createServer((req, res) => {
    void (async () => {
      if (!controls.available) {
        res.writeHead(503).end();
        return;
      }
      if (req.url === "/keys") {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ keys: [jwk] }));
        return;
      }
      if (
        req.headers.authorization !==
        `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`
      ) {
        res.writeHead(401).end();
        return;
      }
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const raw = Buffer.concat(chunks).toString("utf8");
      const data = new URLSearchParams(raw);
      res.setHeader("Content-Type", "application/json");
      if (req.url === "/oauth/token") {
        const code = data.get("code") ?? "",
          record = codes.get(code);
        codes.delete(code);
        if (
          !record ||
          data.get("redirect_uri") !== `${base}/auth/nox/callback` ||
          createHash("sha256")
            .update(data.get("code_verifier") ?? "")
            .digest("base64url") !== record.challenge
        ) {
          res.writeHead(400).end("{}");
          return;
        }
        const access = secret(),
          expires = Date.now() + 365 * 86400000;
        credentials.set(access, { identity: record.identity, expires });
        const token = await new SignJWT({
          ...record.identity,
          nonce: controls.badNonce ? "bad" : record.nonce,
          at_hash: controls.badHash
            ? "bad"
            : createHash("sha256").update(access).digest().subarray(0, 16).toString("base64url"),
        })
          .setProtectedHeader({ alg: "ES256", kid: "fixture" })
          .setIssuer(config.issuer)
          .setAudience(controls.badAudience ? "other-client" : config.clientId)
          .setIssuedAt()
          .setExpirationTime("5m")
          .sign(controls.badSignature ? otherKeys.privateKey : keys.privateKey);
        res.end(
          JSON.stringify({
            access_token: access,
            token_type: "Bearer",
            id_token: token,
            expires_in: 365 * 86400,
          }),
        );
      } else if (req.url === "/oauth/introspect") {
        controls.introspections++;
        const credential = credentials.get(data.get("token") ?? "");
        res.end(
          JSON.stringify(
            credential && controls.active
              ? {
                  active: true,
                  client_id: config.clientId,
                  exp: Math.floor(credential.expires / 1000),
                  ...credential.identity,
                }
              : { active: false },
          ),
        );
      } else if (req.url === "/v1/logout") {
        const body = JSON.parse(raw) as { token: string };
        credentials.delete(body.token);
        res.writeHead(204).end();
      } else res.writeHead(404).end();
    })().catch(() => {
      res.writeHead(500).end();
    });
  });
  const socket = join(directory, "auth.sock");
  provider.listen(socket);
  await once(provider, "listening");
  const login = new NoXLogin(config, socket);
  const app = createApp(store, options.webDir, {
    login,
    ownerEmail: "owner@example.test",
    dataDirectory: directory,
  });
  http.on("request", app);
  const owner: Identity = {
    sub: "owner-subject",
    email: "owner@example.test",
    name: "Test Owner",
    email_verified: true,
    nox_admin: true,
    google_sub: "google-owner",
  };
  const authorize = (url: string, identity = owner) => {
    const params = new URL(url).searchParams,
      code = secret();
    codes.set(code, {
      identity,
      nonce: params.get("nonce")!,
      challenge: params.get("code_challenge")!,
    });
    return new URLSearchParams({ code, state: params.get("state")! });
  };
  const start = async () => {
    const response = await fetch(`${base}/auth/nox/start`, {
      method: "POST",
      headers: { Origin: base },
      redirect: "manual",
    });
    return {
      response,
      cookie: response.headers
        .getSetCookie()
        .find((value) => value.startsWith("pc_login_transaction="))!
        .split(";")[0],
      url: response.headers.get("location")!,
    };
  };
  const signIn = async (identity = owner) => {
    const begun = await start();
    const response = await fetch(
      `${base}/auth/nox/callback?${authorize(begun.url, identity).toString()}`,
      {
        headers: { Cookie: begun.cookie },
        redirect: "manual",
      },
    );
    const browser = response.headers
      .getSetCookie()
      .find((value) => value.startsWith("pc_admin_session="))
      ?.split(";")[0];
    if (!browser) throw new Error("Fixture login failed");
    const session = (await (
      await fetch(`${base}/auth/session`, { headers: { Cookie: browser } })
    ).json()) as { csrf: string; actor: { role: string } };
    return { cookie: browser, csrf: session.csrf, session };
  };
  const closeServer = async (server: Server) => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  };
  const close = async () => {
    await app.locals.closeManagement();
    await closeServer(http);
    await closeServer(provider);
    store.close();
    rmSync(directory, { recursive: true, force: true });
  };
  t?.after(close);
  return {
    base,
    store,
    app,
    http,
    controls,
    owner,
    login,
    directory,
    start,
    authorize,
    signIn,
    close,
  };
}
