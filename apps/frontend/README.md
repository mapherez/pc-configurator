Frontend (Vite + React)

React + TypeScript app for the PC Configurator UI.

Getting Started
- Install deps (monorepo root): `npm ci`
- Dev server: `npm run dev -w apps/frontend` (http://localhost:5173)
- Build: `npm run build -w apps/frontend`
- Preview: `npm run preview -w apps/frontend`

Environment
- `VITE_API_URL`: Base URL of the API (e.g., `http://localhost:3001` or your Render URL).
- Copy `.env.example` → `.env` and set `VITE_API_URL`.

Scripts
- `dev`: start the Vite dev server
- `build`: type-check and build for production
- `preview`: preview the production build
- `lint`: run ESLint
- `test`: run tests in watch mode
- `test:run`: run tests once (CI)