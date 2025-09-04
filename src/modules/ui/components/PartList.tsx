import { useMemo, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../../store/hooks'
import { setPart } from '../../build/buildSlice'
import type { Part } from '../../catalog/schema'
import { checkCompatibility, extractSpecs, type SpecsBag } from '../../build/compatibility'
import { applySelectedToUrl } from '../../build/share'
import { useI18n } from '../../i18n/i18n'

// Import mock data (initial offline catalog)
import cpu from '../../catalog/data/cpu.json'
import gpu from '../../catalog/data/gpu.json'
import mobo from '../../catalog/data/motherboard.json'
import ram from '../../catalog/data/ram.json'
import pcCase from '../../catalog/data/case.json'
import psu from '../../catalog/data/psu.json'

type Category = Part['category']

const DATA_BY_CATEGORY: Record<string, Part[]> = {
  cpu: cpu as Part[],
  gpu: gpu as Part[],
  motherboard: mobo as Part[],
  ram: ram as Part[],
  case: pcCase as Part[],
  psu: psu as Part[],
}

const AVAILABLE_CATEGORIES = Object.keys(DATA_BY_CATEGORY) as Category[]

function indexById(list: Part[]): Record<string, Part> {
  const idx: Record<string, Part> = {}
  for (const p of list) idx[p.id] = p as Part
  return idx
}

const INDEX_BY_CATEGORY: Record<string, Record<string, Part>> = Object.fromEntries(
  Object.entries(DATA_BY_CATEGORY).map(([k, v]) => [k, indexById(v)])
) as Record<string, Record<string, Part>>

// currency formatting moved to i18n: formatCurrency

export function PartList() {
  const { t, formatCurrency } = useI18n()
  const dispatch = useAppDispatch()
  const selected = useAppSelector((state) => state.build.selected)
  const setPartAction = (category: Category, partId: string) => dispatch(setPart({ category, partId }))

  const [category, setCategory] = useState<Category>('cpu')
  const [brand, setBrand] = useState<string>('')
  const [minPrice, setMinPrice] = useState<string>('')
  const [maxPrice, setMaxPrice] = useState<string>('')
  const [query, setQuery] = useState<string>('')

  const items = useMemo(() => DATA_BY_CATEGORY[category] ?? [], [category])

  const currentSpecs: SpecsBag = useMemo(() => {
    const bag: SpecsBag = {}
    for (const [cat, id] of Object.entries(selected)) {
      const part = INDEX_BY_CATEGORY[cat]?.[id as string]
      if (part) Object.assign(bag, extractSpecs(part as Part))
    }
    return bag
  }, [selected])

  const brands = useMemo(() => {
    return Array.from(new Set(items.map((p) => p.brand))).sort()
  }, [items])

  const priceBounds = useMemo(() => {
    if (items.length === 0) return { min: 0, max: 0 }
    let min = Infinity
    let max = -Infinity
    for (const it of items) {
      if (it.price < min) min = it.price
      if (it.price > max) max = it.price
    }
    return { min, max }
  }, [items])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const min = minPrice ? parseFloat(minPrice) : -Infinity
    const max = maxPrice ? parseFloat(maxPrice) : Infinity
    return items
      .filter((p) => (brand ? p.brand === brand : true))
      .filter((p) => p.price >= min && p.price <= max)
      .filter((p) => (q ? `${p.name} ${p.brand} ${p.sku}`.toLowerCase().includes(q) : true))
  }, [items, brand, minPrice, maxPrice, query])

  // Keep URL in sync when selection changes (replace state)
  useMemo(() => {
    const url = new URL(window.location.href)
    applySelectedToUrl(url, selected)
    window.history.replaceState(null, '', url)
    return undefined
  }, [selected])

  return (
    <div className="grid grid-cols-[280px_1fr] gap-4">
      <aside className="border-r border-neutral-300 dark:border-neutral-700 pr-4">
        <h2 className="mt-0">{t('FILTERS')}</h2>
        <div className="mb-3">
          <label>
            {t('CATEGORY')}
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="block w-full mt-1.5 px-2 py-1 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
            >
              {AVAILABLE_CATEGORIES.map((c) => (
                <option value={c} key={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mb-3">
          <label>
            {t('BRAND')}
            <select
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="block w-full mt-1.5 px-2 py-1 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
            >
              <option value="">{t('BRAND_ALL')}</option>
              {brands.map((b) => (
                <option value={b} key={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mb-3">
          <label>
            {t('SEARCH')}
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('SEARCH_PLACEHOLDER')}
              className="block w-full mt-1.5 px-2 py-1 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </label>
        </div>
        <div className="flex gap-2">
          <label className="flex-1">
            {t('MIN_PRICE')}
            <input
              type="number"
              inputMode="decimal"
              placeholder={priceBounds.min ? String(priceBounds.min) : '0'}
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="block w-full mt-1.5 px-2 py-1 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </label>
          <label className="flex-1">
            {t('MAX_PRICE')}
            <input
              type="number"
              inputMode="decimal"
              placeholder={priceBounds.max ? String(priceBounds.max) : ''}
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="block w-full mt-1.5 px-2 py-1 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </label>
        </div>
      </aside>
      <main>
        <div className="flex justify-between items-center">
          <h2 className="mt-0">{t('PARTS')}</h2>
          <div className="opacity-80">{t('ITEMS_COUNT', { count: String(filtered.length) })}</div>
        </div>
        <ul className="list-none p-0 m-0">
          {filtered.map((p) => {
            const compat = checkCompatibility(p as Part, currentSpecs)
            const isSelected = selected[p.category as Category] === p.id
            return (
              <li
                key={p.id}
                className={`border border-neutral-300 dark:border-neutral-700 rounded-lg p-3 mb-2 ${
                  isSelected ? 'bg-sky-500/5' : 'bg-transparent'
                }`}
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-xs opacity-80">
                      {p.brand} · {p.category} · {p.sku}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      title={compat.reasons.join('\n')}
                      className={`text-xs px-2 py-0.5 rounded-full border border-neutral-300 dark:border-neutral-700 ${
                        compat.ok === null
                          ? 'bg-transparent'
                          : compat.ok
                          ? 'bg-emerald-500/10'
                          : 'bg-red-500/10'
                      }`}
                    >
                      {compat.ok === null ? '—' : compat.ok ? t('COMPATIBLE') : t('INCOMPATIBLE')}
                    </span>
                    <div className="min-w-[96px] text-right">{formatCurrency(p.price)}</div>
                    <button onClick={() => setPartAction(p.category as Category, p.id)}>
                      {isSelected ? t('SELECTED') : t('SELECT')}
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </main>
    </div>
  )
}

export default PartList
