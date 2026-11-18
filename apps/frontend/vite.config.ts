import { defineConfig, lazyPlugins } from "vite-plus";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// https://vite.dev/config/
export default defineConfig({
  plugins: lazyPlugins(() => [react()]),
  base: "/",
  server: { proxy: { "/api": "http://127.0.0.1:3001" } },
  build: {
    rolldownOptions: {
      input: {
        app: fileURLToPath(new URL("./index.html", import.meta.url)),
        prototype: fileURLToPath(new URL("./prototype.html", import.meta.url)),
      },
    },
  },
});
