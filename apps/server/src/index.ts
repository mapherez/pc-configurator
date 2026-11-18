import { env } from "./env.js";
import { CatalogStore } from "./db.js";
import { createApp } from "./app.js";

const store = new CatalogStore(env.databaseFile);
try {
  const server = createApp(store, env.webDir).listen(env.PORT, env.HOST, () => {
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
      store.close();
      clearTimeout(deadline);
    });
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
} catch (error) {
  store.close();
  throw error;
}
