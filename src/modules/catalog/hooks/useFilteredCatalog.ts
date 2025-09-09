import { useMemo } from 'react'
import type { Part } from '../../catalog/schema'
import { useCatalogData } from './useCatalogFilters'

export type Predicate = (p: Part) => boolean

export function useFilteredCatalog(predicate: Predicate) {
  const data = useCatalogData()

  const filteredByCategory = useMemo(() => {
    const out: Record<string, Part[]> = {}
    for (const [cat, items] of Object.entries(data)) {
      out[cat] = (items as Part[]).filter(predicate)
    }
    return out
  }, [data, predicate])

  return filteredByCategory
}

