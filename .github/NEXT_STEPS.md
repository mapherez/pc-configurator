# UI Refactor: PartList → Filters + Accordions

This document outlines the plan to modernize the PartList UX while keeping current behavior intact and leaving room for future features (stage image, richer filters, virtualization).

## Goals
- Move filters (Brand, Search, Price) to a top FilterBar.
- Render parts inside per‑category collapsible accordions.
- Keep selection logic, compatibility, i18n, and URL sync working.
- Prepare space for a right‑side Stage panel (future work).

## Architecture Overview
- Container: `PartList` orchestrates filters + accordions and reads selection from the store.
- Components:
  - `FilterBar`: Brand select, Search, Min/Max price.
  - `AccordionList`/`AccordionItem`: One item per category with count and collapsible panel.
  - `PartListItem`: Existing row/card reused inside each accordion panel.
- Hooks:
  - `useCatalogFilters`: manages filter state and builds a predicate; derives available brands.
  - `useFilteredCatalog`: memoized map of category → filtered parts, based on predicate.

## Data Flow & Filters
- Global filters apply across all categories.
- Search matches `name`, `brand`, and `sku` (case‑insensitive).
- Price range parses to numbers with safe defaults.
- Brands list sourced from catalog (or filtered catalog), unique + sorted.

## URL & State
- Keep selection → URL sync centralized in `UrlSyncProvider` (already implemented).
- Do not encode filters or accordion open state in the URL initially (can be added later).
- Selection hydration from URL remains as is.

## Accessibility
- Accordion headers are `<button>` with `aria-expanded` and `aria-controls`.
- Panels use `role="region"` and `id` linked to headers.
- Filter inputs have associated `<label>` and `aria-label` where appropriate.

## Styling
- Use Tailwind utility classes for a clean, modern look.
- Accordion header shows: category label + localized items count; chevron rotates on open.
- Reuse current list row/card styles in panels for consistency.
- FilterBar: compact row that wraps on small screens.

## Performance
- Memoize filtered results per category (`useMemo`).
- Reuse `currentSpecs` memo for compatibility checks.
- If catalogs grow: consider list virtualization (future).

## Testing
- Update smoke test:
  - Expand CPU accordion, select a part, verify BuildSummary.
  - Expand Motherboard, verify incompatibility label.
- Unit tests (add if time allows):
  - `useCatalogFilters` predicate with brand/search/price.
  - Accordion accessibility attributes (aria‑expanded/controls).

## Rollout Steps
1) Create components
   - `src/modules/ui/components/filters/FilterBar.tsx`
   - `src/modules/ui/components/accordion/AccordionList.tsx`
   - `src/modules/ui/components/accordion/AccordionItem.tsx`
   - `src/modules/ui/components/parts/PartListItem.tsx` (extract from current list row)
2) Create hooks
   - `src/modules/catalog/hooks/useCatalogFilters.ts`
   - `src/modules/catalog/hooks/useFilteredCatalog.ts`
3) Refactor `PartList`
   - Replace left aside/right main with:
     - Top `FilterBar`
     - Below: `AccordionList` with one `AccordionItem` per category
   - Keep existing compatibility, price formatting, and select actions
4) Wire counts & i18n
   - Use `tn('ITEMS_COUNT', count)` for each accordion header
5) Tests & polish
   - Update smoke test to interact with accordions
   - Quick manual pass across locales and markets

## Future: Stage Panel (Right Side)
- Add `StagePanel` in layout between PartList and BuildSummary.
- Inputs: selected parts from the store.
- Later: map selection → layered image assets; animate transitions on selection changes.

## Nice‑to‑Haves (Optional)
- Persist accordion open state in `localStorage`.
- Add filter persistence (URL or local storage) if desired.
- Virtualize long lists for large catalogs.

