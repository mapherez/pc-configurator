import React, { useEffect, useMemo, useState } from 'react'
import type { Part } from './schema'
import { fetchParts, type ApiPart } from '../../lib/api'
import { CatalogCtx, type CatalogState } from './context'

type CatalogByCategory = Record<string, Part[]>

function mapApiPartToPart(api: ApiPart): Part {
  const priceNum = typeof api.price === 'string' ? parseFloat(api.price) : api.price
  const categoryName = (api.category?.name ?? '').toLowerCase()
  return {
    id: api.slug,
    sku: api.sku ?? '',
    name: api.name,
    brand: api.brand ?? '',
    category: categoryName as Part['category'],
    price: Number.isFinite(priceNum) ? (priceNum as number) : 0,
    images: Array.isArray(api.images) ? api.images : [],
    // specs JSON is free-form but our UI expects simple scalar/array values
    specs: (api.specs ?? {}) as Record<string, string | number | boolean | Array<string | number | boolean>>,
  }
}

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const [catalogByCategory, setCatalog] = useState<CatalogByCategory>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const apiParts = await fetchParts()
      const mapped = apiParts.map(mapApiPartToPart)
      const grouped: CatalogByCategory = {}
      for (const p of mapped) {
        if (!grouped[p.category]) grouped[p.category] = []
        grouped[p.category].push(p)
      }
      setCatalog(grouped)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load catalog')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const value: CatalogState = useMemo(
    () => ({
      catalogByCategory,
      allParts: Object.values(catalogByCategory).flat() as Part[],
      loading,
      error,
      refresh: load,
    }),
    [catalogByCategory, loading, error]
  )

  return <CatalogCtx.Provider value={value}>{children}</CatalogCtx.Provider>
}
