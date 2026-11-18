import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
function readVersion() {
  let directory = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const path = join(directory, "package.json");
    if (existsSync(path)) {
      const value = JSON.parse(readFileSync(path, "utf8")) as { name?: string; version?: string };
      if (value.name === "pc-configurator" && typeof value.version === "string")
        return value.version;
    }
    const parent = dirname(directory);
    if (parent === directory) return "development";
    directory = parent;
  }
}
export const applicationVersion = readVersion();
