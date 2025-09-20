Server (Express + Prisma + SQLite/Turso)

Database workflow
- `npm run db:0:generate` – regenerate Prisma Client (safe to run anytime)
- `npm run db:1:migrate:local` – create/apply migrations against `prisma/dev.db`
- `npm run db:2:apply:turso` – push the latest migration to Turso (pass a folder name with `--` to override)
- `npm run db:3:seed:turso` – seed the remote Turso database using `prisma/seed.ts`

Local development
- Install deps: cd apps/server && npm i
- Copy .env.example to .env (defaults to file:./dev.db)
- Run through the database workflow (steps 0-2) as needed
- Seed data locally: temporarily unset Turso vars then run `npm run seed`
- Start dev server: npm run dev (http://localhost:3001)

Turso / production
- Set TURSO_DATABASE_URL (+ TURSO_AUTH_TOKEN for writes)
- Optionally keep DATABASE_URL=file:./dev.db for local tooling
- Build: npm run build
- Apply schema: npm run db:2:apply:turso (uses latest migration unless overridden)
- Seed: npm run db:3:seed:turso (idempotent upserts)
- Start: npm run start

Environment variables
- DATABASE_URL: SQLite connection string (defaults to file:./dev.db)
- TURSO_DATABASE_URL: Turso libSQL endpoint (libsql://...)
- TURSO_AUTH_TOKEN: Turso auth token (required for writes)
- PORT: HTTP port (default 3001)
- CORS_ORIGINS: comma-separated allowlist (http://localhost:5173, https://*.vercel.app)

Render deployment (web service)
- Root Directory: apps/server
- Build Command: npm ci && npm run build && npx prisma generate
- Start Command: npm run start
- Migrations: run `npm run db:2:apply:turso -- <migration_folder>` via deploy hook or job
- Env vars: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, NODE_ENV=production, CORS_ORIGINS

API routes
- GET /health - basic health check
- GET /api/parts - list parts with categories
- POST /api/parts - create part { name, price, categoryId? }
