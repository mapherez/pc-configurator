# PC Configurator

Build custom PC lists, filter parts, and get compatibility hints. Frontend in React + Vite, backend in Express + Prisma, SQLite locally with Turso (libSQL) in production - all in a single monorepo.

## Live Demo
https://pc-configurator-frontend.vercel.app/

![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite)
![Turso](https://img.shields.io/badge/Database-Turso-7F5AF0)
![Vercel](https://img.shields.io/badge/Hosted_on-Vercel-000000?logo=vercel)
![Render](https://img.shields.io/badge/API_on-Render-46E3B7?logo=render)

# Overview
- Frontend: React + TypeScript (Vite), Tailwind, Redux Toolkit.
- Backend: Express + TypeScript, Prisma ORM, Zod validation.
- Database: SQLite (file-based for dev) and Turso libSQL in production.
- Deploy: Vercel (frontend) + Render (API). GitHub Actions for CI.

## Monorepo Structure
- `apps/frontend`: Vite + React UI
- `apps/server`: Express + Prisma API
- `packages/*`: shared packages (future)

## Getting Started
- Requirements: Node 18+ and npm. Turso CLI optional for remote management.
- Install: run `npm ci` at the repo root to install workspaces.
- Environment:
  - `apps/server`: copy `.env.example` to `.env`. Defaults use SQLite (`file:./dev.db`). Set `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` when targeting Turso.
  - `apps/frontend`: create `.env` with `VITE_API_BASE` (optional in dev; see below).
- Development:
  - API: `npm run dev -w apps/server` ? http://localhost:3001
  - Frontend: `npm run dev -w apps/frontend` ? http://localhost:5173
  - Dev fallback: the frontend auto-targets `http://localhost:3001` when running on port 5173.

## Database + Prisma
- Schema: `apps/server/prisma/schema.prisma`
- Migrations: `apps/server/prisma/migrations/`
- Workflow (ordered helpers):
  1. `npm run db:0:generate -w apps/server`
  2. `npm run db:1:migrate:local -w apps/server`
  3. `npm run db:2:apply:turso -w apps/server [-- <folder>]`
  4. `npm run db:3:seed:turso -w apps/server`
- Local-only seed: unset Turso vars, then `npm run seed -w apps/server`
- Seed fixtures live in `apps/server/prisma/data`

## API Endpoints
- `GET /health` ? health info
- `GET /api/parts` ? list parts (includes category)
- `POST /api/parts` ? create a part; body: `{ name: string, price: number, categoryId?: number }`

## Scripts (root)
- `dev:frontend` ? `npm run dev -w apps/frontend`
- `dev:server` ? `npm run dev -w apps/server`
- `build:frontend` ? `npm run build -w apps/frontend`
- `build:server` ? `npm run build -w apps/server`
- `test` (frontend) ? `npm run test -w apps/frontend` or `npm run test:run -w apps/frontend`

## Deploy
- Frontend (Vercel):
  - Root Directory: `apps/frontend`
  - Build Command: `npm run build`
  - Output Directory: `dist`
  - Environment Variables: set `VITE_API_BASE` to your API origin (e.g., `https://pc-configurator-api-s40v.onrender.com`).
- Backend (Render + Turso):
  - Web Service from this repo (monorepo root).
  - Build Command: `npm ci && npm run db:0:generate -w apps/server && npm run build:server`
  - Start Command: `npm run db:2:apply:turso -w apps/server && npm run start -w apps/server`
  - Environment Variables: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `NODE_ENV=production`, `CORS_ORIGINS`.

## Notes
- CORS: server allows `.vercel.app` by default; add custom domains in `CORS_ORIGINS`.
- `DATABASE_URL` defaults to the local SQLite file and is overridden when `TURSO_DATABASE_URL` is present.
- `VITE_API_BASE`: set for production/frontend builds; dev falls back to `http://localhost:3001` when Vite runs on port 5173.
- Secrets: keep production secrets in hosting provider env vars, not committed files.

## Roadmap
- Category ordering and improved filters
- Backend filtering/pagination
- Saved builds and user sessions
- Shared types package
- Add 3D PC model to stage
