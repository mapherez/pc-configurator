PC Configurator

Build custom PC lists, filter parts, and get compatibility hints. Frontend in React + Vite, backend in Express + Prisma, PostgreSQL for storage — all in a single monorepo.

Live Demo
- https://pc-configurator-frontend.vercel.app/

Badges
- ![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)
- ![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
- ![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite)
- ![Express](https://img.shields.io/badge/Express-4-000000?logo=express)
- ![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma)
- ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)
- ![Vercel](https://img.shields.io/badge/Hosted_on-Vercel-000000?logo=vercel)
- ![Render](https://img.shields.io/badge/API_on-Render-46E3B7?logo=render)

Overview
- Frontend: React + TypeScript (Vite), Tailwind, Redux Toolkit.
- Backend: Express + TypeScript, Prisma ORM, Zod validation.
- Database: PostgreSQL (Render).
- Deploy: Vercel (frontend) + Render (API). GitHub Actions for CI.

Monorepo Structure
- `apps/frontend`: Vite + React UI
- `apps/server`: Express + Prisma API
- `packages/*`: shared packages (future)

Getting Started
- Requirements: Node 18+ and PostgreSQL (or a `DATABASE_URL` to a hosted DB).
- Install: run `npm ci` at the repo root to install workspaces.
- Environment:
  - `apps/server`: create `.env` with `DATABASE_URL`, optionally `CORS_ORIGINS`.
  - `apps/frontend`: create `.env` with `VITE_API_BASE` (optional in dev; see below).
- Development:
  - API: `npm run dev -w apps/server` → http://localhost:3001
  - Frontend: `npm run dev -w apps/frontend` → http://localhost:5173
  - Dev fallback: the frontend auto-targets `http://localhost:3001` when running on port 5173.

Database + Prisma
- Prisma schema: `apps/server/prisma/schema.prisma`
- Migrations: `apps/server/prisma/migrations/`
- Generate client: `npm run prisma:generate -w apps/server`
- Dev migrate: `npm run prisma:migrate -w apps/server`
- Deploy migrate: `npm run prisma:deploy -w apps/server`
- Seed data: `npm run seed -w apps/server` (uses JSON fixtures in `apps/server/prisma/data`)

API Endpoints
- `GET /health` → health info
- `GET /api/parts` → list parts (includes category)
- `POST /api/parts` → create a part; body: `{ name: string, price: number, categoryId?: number }`

Scripts (root)
- `dev:frontend` → `npm run dev -w apps/frontend`
- `dev:server` → `npm run dev -w apps/server`
- `build:frontend` → `npm run build -w apps/frontend`
- `build:server` → `npm run build -w apps/server`
- `test` (frontend) → `npm run test -w apps/frontend` or `npm run test:run -w apps/frontend`

Deploy
- Frontend (Vercel):
  - Root Directory: `apps/frontend`
  - Build Command: `npm run build`
  - Output Directory: `dist`
  - Environment Variables: set `VITE_API_BASE` to your API origin (e.g., `https://pc-configurator-api-s40v.onrender.com`).
- Backend (Render):
  - Web Service from this repo (monorepo root).
  - Build Command: `npm ci && npm run prisma:generate -w apps/server && npm run build:server`
  - Start Command: `npm run prisma:deploy -w apps/server && npm run start -w apps/server`
  - Environment Variables: `DATABASE_URL` (required), `NODE_ENV=production`, `CORS_ORIGINS` (comma-separated frontend origins).

Notes
- CORS: server allows `.vercel.app` by default; add custom domains in `CORS_ORIGINS`.
- `VITE_API_BASE`: set for production/frontend builds; dev falls back to `http://localhost:3001` when Vite runs on port 5173.
- Secrets: keep production secrets in hosting provider env vars, not committed files.

Roadmap
- Category ordering and improved filters
- Backend filtering/pagination
- Saved builds and user sessions
- Shared types package

