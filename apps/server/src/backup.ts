import Database from "better-sqlite3";
import { openSync, closeSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { env } from "./env.js";

const destination = process.argv[2];
if (!destination) throw new Error("Usage: npm run db:backup -- /absolute/path/catalog-backup.db");
const output = resolve(destination);
// Reserve a fresh path; never replace the live database or a previous backup.
const reservation = openSync(output, "wx", 0o600);
closeSync(reservation);
let source: Database.Database | undefined;
try {
  source = new Database(env.databaseFile, { readonly: true, fileMustExist: true });
  await source.backup(output);
  // Restoring content must never restore revoked browser sessions or AI access.
  const backup = new Database(output);
  try {
    if (backup.prepare("SELECT name FROM sqlite_master WHERE name = 'auth_sessions'").get()) {
      backup.pragma("foreign_keys = ON");
      backup.pragma("secure_delete = ON");
      backup.transaction(() => {
        backup.exec(
          "DELETE FROM auth_delegations; DELETE FROM auth_transactions; DELETE FROM auth_sessions;",
        );
      })();
      backup.exec("VACUUM");
    }
  } finally {
    backup.close();
  }
  console.log(`Backup saved to ${output}`);
} catch (error) {
  rmSync(output, { force: true });
  throw error;
} finally {
  source?.close();
}
