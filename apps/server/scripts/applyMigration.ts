import { createClient } from '@libsql/client';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../src/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const migrationsDir = resolve(__dirname, '..', 'prisma', 'migrations');

async function resolveTarget(input?: string) {
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  const folders = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();

  if (folders.length === 0) {
    throw new Error('No migrations found in prisma/migrations');
  }

  if (input) {
    if (!folders.includes(input)) {
      throw new Error(`Migration "${input}" was not found. Available: ${folders.join(', ')}`);
    }
    return input;
  }

  return folders.at(-1)!;
}

async function loadStatements(target: string) {
  const migrationPath = resolve(migrationsDir, target, 'migration.sql');
  const buffer = await readFile(migrationPath, 'utf8');
  const sanitized = buffer.replace(/--.*$/gm, '');
  return sanitized
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function main() {
  if (!env.TURSO_DATABASE_URL) {
    throw new Error('TURSO_DATABASE_URL is required to apply migrations');
  }

  const target = await resolveTarget(process.argv[2]);
  const statements = await loadStatements(target);

  if (statements.length === 0) {
    console.log(`No SQL statements found for migration ${target}`);
    return;
  }

  const client = createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });

  try {
    for (const statement of statements) {
      await client.execute(statement);
    }
  } finally {
    await client.close();
  }

  console.log(`Applied ${statements.length} statements from migration ${target}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
