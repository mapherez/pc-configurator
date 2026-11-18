import { mkdirSync, readFileSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import { resolve } from "node:path";
import { AuthConfigSchema, origin, secret, unixRequest } from "./nox-login.js";
import "dotenv/config";
const issuer = origin(process.env.NOX_AUTH_PUBLIC_URL ?? "", true);
const publicOrigin = origin(process.env.PC_CONFIGURATOR_PUBLIC_URL ?? "");
const directory = resolve(process.env.PC_CONFIGURATOR_DATA_DIR ?? "./data");
mkdirSync(directory, { recursive: true, mode: 0o700 });
const file = resolve(directory, "nox-login.json");
let config;
if (existsSync(file)) {
  config = AuthConfigSchema.parse(JSON.parse(readFileSync(file, "utf8")));
  if (config.issuer !== issuer || config.publicOrigin !== publicOrigin)
    throw new Error(
      "Stored NoX Login origins differ; retain the registered origins or configure a separate installation.",
    );
} else {
  config = { issuer, publicOrigin, clientId: "pc-configurator" as const, clientSecret: secret() };
  writeFileSync(file, JSON.stringify(config), { flag: "wx", mode: 0o600 });
}
chmodSync(file, 0o600);
const result = await unixRequest(
  process.env.NOX_AUTH_ADMIN_SOCKET ?? "/run/nox-auth-admin/control.sock",
  "/v1/clients/pc-configurator",
  "PUT",
  JSON.stringify({
    client_secret: config.clientSecret,
    redirect_uris: [`${publicOrigin}/auth/nox/callback`],
    suite_logout: false,
  }),
  { "Content-Type": "application/json" },
);
if (result.status !== 200) throw new Error(`NoX Login registration failed (${result.status}).`);
console.log("NoX Login client configured.");
