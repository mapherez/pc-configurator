import { useMemo } from 'react'
import type { Part } from '../../catalog/schema'
import { extractSpecs, type SpecsBag } from '../../build/compatibility'
import { useAppSelector } from '../../../store/hooks'
import { useI18n } from '../../i18n/i18n'
import FilterBar from './filters/FilterBar'
import AccordionList from './accordion/AccordionList'
import AccordionItem from './accordion/AccordionItem'
import PartListItem from './parts/PartListItem'
import { useCatalogFilters, useCatalogData } from '../../catalog/hooks/useCatalogFilters'
import { useFilteredCatalog } from '../../catalog/hooks/useFilteredCatalog'

export function PartList() {
  const { tn } = useI18n()
  const selected = useAppSelector((state) => state.build.selected)

  // Global filters and predicate
  const filters = useCatalogFilters()
  const filteredByCategory = useFilteredCatalog(filters.predicate)
  const catalog = useCatalogData()

  // Build current specs bag from selected parts
  const indexById = (list: Part[]): Record<string, Part> => {
    const idx: Record<string, Part> = {}
    for (const p of list) idx[p.id] = p as Part
    return idx
  }
  const indexByCategory: Record<string, Record<string, Part>> = useMemo(
    () => Object.fromEntries(Object.entries(catalog).map(([k, v]) => [k, indexById(v as Part[])])) as Record<string, Record<string, Part>>,
    [catalog]
  )

  const currentSpecs: SpecsBag = useMemo(() => {
    const bag: SpecsBag = {}
    for (const [cat, id] of Object.entries(selected)) {
      const part = indexByCategory[cat]?.[id as string]
      if (part) Object.assign(bag, extractSpecs(part as Part))
    }
    return bag
  }, [selected, indexByCategory])

  const categories = useMemo(() => Object.keys(catalog), [catalog])

  return (
    <div className="flex flex-col gap-5 h-full">
      <FilterBar
        brand={filters.brand}
        setBrand={filters.setBrand}
        brands={filters.brands}
        query={filters.query}
        setQuery={filters.setQuery}
        priceMin={filters.priceMin}
        setPriceMin={filters.setPriceMin}
        priceMax={filters.priceMax}
        setPriceMax={filters.setPriceMax}
        sliderBounds={filters.sliderBounds}
        sliderMaxDynamic={filters.sliderMaxDynamic}
      />

      <div className="flex-1 min-h-0 overflow-y-auto pr-2 thin-scrollbar">
        <AccordionList className="flex flex-col gap-4">
          {categories.map((cat) => {
            const items = filteredByCategory[cat] ?? []
            return (
              <AccordionItem
              key={cat}
              title={cat}
              countLabel={tn('ITEMS_COUNT', items.length)}
              defaultOpen={true}
            >
              <ul className="list-none p-0 m-0 grid grid-cols-1 gap-2">
                {items.map((part) => (
                  <PartListItem key={part.id} part={part as Part} currentSpecs={currentSpecs} />
                ))}
              </ul>
            </AccordionItem>
          )
          })}
        </AccordionList>
      </div>
    </div>
  )
}

export default PartList
