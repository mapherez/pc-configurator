Server (Express + Prisma)

Local development
- Install deps: cd apps/server && npm i
- Set env: copy .env.example to .env and set DATABASE_URL
- Generate client: npx prisma generate
- Run migrations: npm run prisma:migrate
- Seed data: npm run seed
- Start dev server: npm run dev (http://localhost:3001)

Environment variables
- DATABASE_URL: PostgreSQL connection string
- PORT: HTTP port (default 3001)
- CORS_ORIGINS: comma-separated origins to allow CORS (e.g. http://localhost:5173, https://*.vercel.app)

Render deployment (web service)
- Root Directory: apps/server
- Build Command: npm ci && npm run build && npx prisma generate
- Start Command: npm run start
- Migrations: run "npx prisma migrate deploy" as a deploy hook or one-off job
- Env vars: DATABASE_URL, NODE_ENV=production, CORS_ORIGINS

API routes
- GET /health — basic health check
- GET /api/parts — list parts with categories
- POST /api/parts — create part { name, price, categoryId? }