import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  NODE_ENV: z.string().default('development'),
  PORT: z.string().optional(),
  CORS_ORIGINS: z.string().optional(),
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

export const env = {
  DATABASE_URL: raw.DATABASE_URL,
  NODE_ENV: raw.NODE_ENV,
  PORT: raw.PORT ? Number(raw.PORT) : 3001,
  CORS_ORIGINS: parseOrigins(raw.CORS_ORIGINS),
};

