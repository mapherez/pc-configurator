import express, { type ErrorRequestHandler } from "express";
import { existsSync } from "node:fs";
import { resolve, extname } from "node:path";
import type { CatalogStore } from "./db.js";

export function createApp(store: CatalogStore, webDir?: string) {
  const app = express();
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });
  app.get("/health", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      store.assertReady();
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });
  app.get("/api/parts", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json(store.listParts());
  });
  app.all("/api/parts", (_req, res) => {
    res.setHeader("Allow", "GET, HEAD");
    res.status(405).json({ error: "method_not_allowed" });
  });
  app.use("/api", (_req, res) => res.status(404).json({ error: "not_found" }));
  if (webDir) {
    const directory = resolve(webDir);
    if (!existsSync(resolve(directory, "index.html")))
      throw new Error("Build the frontend before starting the web server.");
    app.use(express.static(directory, { index: "index.html", etag: true }));
    app.get("*", (req, res, next) => {
      if (extname(req.path) || !req.accepts("html")) return next();
      res.sendFile(resolve(directory, "index.html"));
    });
  }
  app.use((_req, res) => res.status(404).json({ error: "not_found" }));
  const onError: ErrorRequestHandler = (error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ error: "internal_error" });
  };
  app.use(onError);
  return app;
}
