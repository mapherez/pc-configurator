import { useMemo, useState, useCallback, useEffect } from 'react'
import type { Part } from '../../catalog/schema'

// Local catalog import (initial offline data)
import cpu from '../../catalog/data/cpu.json'
import gpu from '../../catalog/data/gpu.json'
import mobo from '../../catalog/data/motherboard.json'
import ram from '../../catalog/data/ram.json'
import pcCase from '../../catalog/data/case.json'
import psu from '../../catalog/data/psu.json'

export type CatalogByCategory = Record<string, Part[]>

export const DATA_BY_CATEGORY: CatalogByCategory = {
  cpu: cpu as Part[],
  gpu: gpu as Part[],
  motherboard: mobo as Part[],
  ram: ram as Part[],
  case: pcCase as Part[],
  psu: psu as Part[],
}

const ALL_PARTS: Part[] = Object.values(DATA_BY_CATEGORY).flat() as Part[]

export type FiltersState = {
  brand: string
  query: string
  priceMin: number | null
  priceMax: number | null
}

export type FiltersApi = FiltersState & {
  setBrand: (v: string) => void
  setQuery: (v: string) => void
  setPriceMin: (v: number | null) => void
  setPriceMax: (v: number | null) => void
  brands: string[]
  sliderBounds: { min: number; max: number }
  sliderMaxDynamic: number
  predicate: (p: Part) => boolean
}

export function useCatalogFilters(): FiltersApi {
  const [brand, setBrand] = useState<string>('')
  const [query, setQuery] = useState<string>('')
  const [priceMin, setPriceMin] = useState<number | null>(null)
  const [priceMax, setPriceMax] = useState<number | null>(null)

  const brands = useMemo(() => Array.from(new Set(ALL_PARTS.map((p) => p.brand))).sort(), [])

  // Static slider bounds minimum is 0; maximum is dynamic based on current brand/query filtered items
  const sliderBounds = useMemo(() => ({ min: 0, max: 0 }), [])

  const brandQueryFiltered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return ALL_PARTS.filter((p) => (brand ? p.brand === brand : true)).filter((p) =>
      q ? `${p.name} ${p.brand} ${p.sku}`.toLowerCase().includes(q) : true
    )
  }, [brand, query])

  const sliderMaxDynamic = useMemo(() => {
    let max = 0
    for (const it of brandQueryFiltered) if (it.price > max) max = it.price
    return max
  }, [brandQueryFiltered])

  // Ensure current priceMax does not exceed dynamic bound; also ensure priceMin <= priceMax
  useEffect(() => {
    setPriceMax((prev) => (prev != null ? Math.min(prev, sliderMaxDynamic) : prev))
  }, [sliderMaxDynamic])

  useEffect(() => {
    setPriceMin((prev) => {
      const max = priceMax ?? Infinity
      if (prev != null && prev > max) return max
      return prev
    })
  }, [priceMax])

  const predicate = useCallback(
    (p: Part) => {
      const q = query.trim().toLowerCase()
      const min = priceMin != null ? priceMin : -Infinity
      const max = priceMax != null ? priceMax : Infinity
      if (brand && p.brand !== brand) return false
      if (p.price < min || p.price > max) return false
      if (q) {
        const hay = `${p.name} ${p.brand} ${p.sku}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    },
    [brand, query, priceMin, priceMax]
  )

  return {
    brand,
    query,
    priceMin,
    priceMax,
    setBrand,
    setQuery,
    setPriceMin,
    setPriceMax,
    brands,
    sliderBounds,
    sliderMaxDynamic,
    predicate,
  }
}

export function useCatalogData() {
  return DATA_BY_CATEGORY
}
