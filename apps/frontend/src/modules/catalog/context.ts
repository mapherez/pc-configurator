import { createContext, useContext } from 'react'
import type { Part } from './schema'

export type CatalogByCategory = Record<string, Part[]>

export type CatalogState = {
  catalogByCategory: CatalogByCategory
  allParts: Part[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export const CatalogCtx = createContext<CatalogState | undefined>(undefined)

export function useCatalog() {
  const ctx = useContext(CatalogCtx)
  if (!ctx) throw new Error('useCatalog must be used within CatalogProvider')
  return ctx
}

