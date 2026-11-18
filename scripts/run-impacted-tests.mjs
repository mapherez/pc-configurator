#!/usr/bin/env node
import { execFileSync } from "node:child_process";

const files = execFileSync("git", ["diff", "--cached", "--name-only", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const shared = files.some(
  (file) =>
    ["package.json", "package-lock.json", "vite.config.ts"].includes(file) ||
    file.startsWith("packages/domain/"),
);
// Catalogue fixtures are consumed by both the server and the prototype.
const catalog = files.some((file) => file.startsWith("apps/server/catalog/"));
if (shared)
  execFileSync("npm", ["run", "test:run", "--workspace", "@pc-configurator/domain"], {
    stdio: "inherit",
  });
for (const workspace of ["frontend", "server"]) {
  const impacted =
    shared ||
    catalog ||
    files.some(
      (file) => file.startsWith(`apps/${workspace}/`) && /\.(?:[cm]?[jt]sx?|json)$/.test(file),
    );
  if (impacted) {
    console.log(`[tests] Checking ${workspace} ...`);
    execFileSync("npm", ["run", "test:run", "--workspace", `apps/${workspace}`], {
      stdio: "inherit",
    });
  } else console.log(`[tests] No ${workspace} changes requiring tests`);
}
