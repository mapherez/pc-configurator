PC Configurator – TODOs

Purpose
- A living backlog of improvements for product, code quality, DX, and ops.

Product & UX
- Category order: Display categories in a fixed, sensible order (cpu, gpu, motherboard, ram, psu, case, ...).
- Sorting: Add sort controls (price asc/desc, TDP, brand, name).
- Loading states: Skeletons/spinners for initial fetch and per-category lists.
- Empty/error states: Friendly messages with retry; expose CatalogProvider.refresh().
- Price formatting: Respect locale/currency from settings across UI.
- Accessibility: Ensure keyboard navigation and aria labels for accordions/lists.
- Mobile polish: Check small screens; ensure sticky filters and summary behavior.

Frontend
- Catalog context
  - Memoize and expose brand list, price bounds from provider to avoid recompute in hooks.
  - Add a light cache invalidation (timestamp) and a manual “Refresh” button in UI.
- Filters
  - Keep filters in URL (query params) for shareable filtered views.
  - Debounce search input; highlight matches.
- Build summary
  - Surface compatible/incompatible callouts inline with items; link to reason.
  - Add quick actions: “Replace” suggestions based on compatibility.
- Performance
  - Code-split routes/components; verify bundle size.
  - Image handling: lazy-load images and support thumbnails (once API provides).

Backend (API)
- Endpoints
  - GET /api/parts: support query params (category, brand, q, priceMin, priceMax, sort, page, pageSize).
  - GET /api/brands: list distinct brands (optionally by category).
  - GET /api/categories: list categories (with counts).
- Data contracts
  - Add stable IDs in API responses: return both slug and numeric id.
  - Ensure price returns as string for precision and document it.
- Performance & hardening
  - Caching headers (ETag/Last-Modified) for parts lists; short-lived cache.
  - Rate limiting (basic per-IP) and helmet for security headers.
  - Logging (request logs with minimal PII), structured errors.

Database & Seeding
- Seed quality
  - Validate seeds with zod before upsert; report invalid entries.
  - Normalize brand names (case, spacing) in seed for consistent filtering.
- Schema
  - Consider optional fields (sku/brand) if business rules allow.
  - Add createdBy/updatedBy in future (if auth appears).

Testing & Quality
- Frontend tests
  - Add tests for CatalogProvider (loading/error/grouping) and filtering hooks.
  - Snapshot tests for PartList states (loading/empty/error populated).
- Backend tests (scaffold)
  - Set up Vitest + Supertest; test /health and /api/parts queries, pagination.
  - Add seed runner for test DB with a minimal dataset.
- E2E (future)
  - Playwright/Cypress to validate selection flow and compatibility rules.

Dev Experience
- ESLint/Prettier
  - Unify ESLint patterns across workspaces; consider type-aware linting on server (perf budgeted).
  - Add Prettier config and script (optional if desired).
- Husky hooks
  - Current: pre-commit lints staged files and runs impacted tests.
  - Optional: add pre-push to run full typecheck (server+frontend) for extra safety.
- Scripts
  - Add root `ci` script to run lint, typecheck, and tests consistently in CI.

CI/CD & Ops
- GitHub Actions
  - Add status badges to README (build, test) and Vercel/Render deployment.
  - Add a job to curl API /health post-build to verify server starts.
- Vercel
  - Optional rewrite to proxy /api to backend (to avoid VITE_API_BASE env if preferred).
  - Ignored build step: skip frontend deploy when only server files changed.
- Render
  - Enable DB backups; document restore steps.
  - Add environment variable docs (DATABASE_URL, CORS_ORIGINS, NODE_ENV).

Documentation
- Add CONTRIBUTING.md with local setup, scripts, and hooks behavior.
- Add .env.example for apps/server and apps/frontend.
- Expand README with screenshots/GIF and Deploy Status section.

Nice-to-haves (Future)
- Saved builds (anonymous + optional auth) and shareable short links.
- Admin data import UI; bulk upload CSV/JSON; thumbnail generation.
- Internationalization: refine locales and currency switching.

Priorities (suggested next steps)
1) API filtering/sorting/pagination and frontend integration.
2) Server test scaffold (Vitest + Supertest) and a couple of route tests.
3) UI polish: category order, loading/error states, retry button.
4) README badges + .env.example files.

