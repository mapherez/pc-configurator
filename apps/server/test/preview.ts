// Isolated manual UI fixture. This entrypoint is never loaded by the application
// and is excluded from the runtime container. It uses a fresh /tmp database and
// a fake local NoX provider, never an installed host identity or Auth socket.
import { resolve } from "node:path";
import { authFixture } from "./auth-fixture.js";
const fixture = await authFixture(undefined, { webDir: resolve("../frontend/dist") });
fixture.http.off("request", fixture.app);
fixture.http.on("request", (req, res) => {
  if (req.url === "/__fixture/sign-in") {
    void fixture
      .signIn()
      .then((session) => {
        res.setHeader("Set-Cookie", `${session.cookie}; HttpOnly; SameSite=Lax; Path=/`);
        res.writeHead(303, { Location: "/admin" }).end();
      })
      .catch(() => res.writeHead(500).end());
  } else fixture.app(req, res);
});
console.log(`Temporary admin UI fixture: ${fixture.base}/__fixture/sign-in`);
const shutdown = () => {
  void fixture.close().then(() => process.exit(0));
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
