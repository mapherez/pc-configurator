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
  console.log(`Backup saved to ${output}`);
} catch (error) {
  rmSync(output, { force: true });
  throw error;
} finally {
  source?.close();
}
