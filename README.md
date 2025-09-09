PC Configurator is a full‑stack app for exploring, filtering, and assembling custom PC builds. It features a React frontend and an Express + Prisma backend backed by PostgreSQL. This repo is a monorepo designed for smooth local development and one‑click deploys (Vercel for the frontend, Render for the backend).

**Overview**
- **Frontend**: React + TypeScript (Vite), Tailwind, React Query, Redux Toolkit.
- **Backend**: Express + TypeScript, Prisma ORM, Zod validation.
- **Database**: PostgreSQL (Render, Supabase, or Neon).
- **Infra**: Vercel (frontend) + Render (API) with GitHub Actions CI.

**Monorepo Layout**
- `apps/frontend`: Vite + React UI (deploys to Vercel)
- `apps/server`: Express + Prisma API (deploys to Render)

**Quick Start**
- **Prereqs**: Node 18+ installed.
- **Install**: `npm ci` (run at repo root to install workspaces)
- **Server env**: copy `apps/server/.env.example` → `apps/server/.env` and set `DATABASE_URL`.
- **Frontend env**: copy `apps/frontend/.env.example` → `apps/frontend/.env` and set `VITE_API_URL` (e.g., `http://localhost:3001`).
- **Run**:
  - `npm run dev -w apps/server` (API on `http://localhost:3001`)
  - `npm run dev -w apps/frontend` (UI on `http://localhost:5173`)

**API**
- `GET /health`: basic health check.
- `GET /api/parts`: list parts with categories.
- `POST /api/parts`: create part `{ name, price, categoryId? }`.

**Deploy**
- **Vercel (frontend)**
  - Root Directory: `apps/frontend`
  - Env: `VITE_API_URL=https://<your-api>.onrender.com` (or `https://api.yourdomain.com`)
- **Render (server)**
  - Root Directory: `apps/server`
  - Build: `npm ci && npm run build && npx prisma generate`
  - Start: `npm run start`
  - Migrations: run `npx prisma migrate deploy` on each deploy
  - Env: `DATABASE_URL`, `NODE_ENV=production`, `CORS_ORIGINS`

**CI**
- GitHub Actions runs lint, tests, and builds both workspaces on pushes and PRs. See `.github/workflows/ci.yml`.

**Roadmap**
- Move frontend to Next.js for SSR/SEO when ready.
- Shared types package (`packages/shared`) for API contracts.
- Auth, saved builds, and a richer parts catalog.
