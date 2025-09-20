import 'dotenv/config';
import { z } from 'zod';

const envSchema = z
  .object({
    DATABASE_URL: z.string().trim().optional(),
    TURSO_DATABASE_URL: z.string().trim().optional(),
    TURSO_AUTH_TOKEN: z.string().trim().optional(),
    NODE_ENV: z.string().default('development'),
    PORT: z.string().optional(),
    CORS_ORIGINS: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.DATABASE_URL && !data.TURSO_DATABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Set DATABASE_URL (local SQLite) or TURSO_DATABASE_URL',
        path: ['DATABASE_URL'],
      });
    }
  });

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const raw = parsed.data;

const defaultOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  /\.vercel\.app$/,
];

function parseOrigins(input?: string) {
  if (!input) return defaultOrigins;
  return input.split(',').map((s) => s.trim()).filter(Boolean);
}

const resolvedDatabaseUrl = raw.TURSO_DATABASE_URL ?? raw.DATABASE_URL ?? 'file:./dev.db';
process.env.DATABASE_URL = resolvedDatabaseUrl;

export const env = {
  DATABASE_URL: resolvedDatabaseUrl,
  NODE_ENV: raw.NODE_ENV,
  PORT: raw.PORT ? Number(raw.PORT) : 3001,
  CORS_ORIGINS: parseOrigins(raw.CORS_ORIGINS),
  TURSO_DATABASE_URL: raw.TURSO_DATABASE_URL,
  TURSO_AUTH_TOKEN: raw.TURSO_AUTH_TOKEN,
};

