import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { AuthConfigSchema, NoXLogin } from "./nox-login.js";
import { env } from "./env.js";
import { CatalogStore } from "./db.js";
import { createApp } from "./app.js";

const store = new CatalogStore(env.databaseFile);
try {
  const configFile = join(dirname(env.databaseFile), "nox-login.json");
  const login = existsSync(configFile)
    ? new NoXLogin(
        AuthConfigSchema.parse(JSON.parse(readFileSync(configFile, "utf8"))),
        env.NOX_AUTH_SOCKET,
      )
    : undefined;
  if (login && !env.PC_CONFIGURATOR_OWNER_EMAIL)
    throw new Error("PC_CONFIGURATOR_OWNER_EMAIL is required for NoX Login.");
  const app = createApp(store, env.webDir, { login, ownerEmail: env.PC_CONFIGURATOR_OWNER_EMAIL });
  const server = app.listen(env.PORT, env.HOST, () => {
    console.log(`PC Configurator listening on http://${env.HOST}:${env.PORT}`);
  });
  server.on("error", (error) => {
    console.error(error);
    store.close();
    process.exitCode = 1;
  });
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => process.exit(1), 10_000).unref();
    server.close(() => {
      void Promise.resolve(app.locals.closeManagement())
        .then(() => {
          store.close();
          clearTimeout(deadline);
        })
        .catch(() => {
          store.close();
          process.exitCode = 1;
          clearTimeout(deadline);
        });
    });
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
} catch (error) {
  store.close();
  throw error;
}
