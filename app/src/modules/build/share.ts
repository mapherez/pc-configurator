import { CategoryEnum } from '../catalog/schema'
import type { z } from 'zod'

export type Category = z.infer<typeof CategoryEnum>
export type SelectedMap = Partial<Record<Category, string>>

const CATEGORIES = (CategoryEnum.options as readonly string[]) as readonly Category[]

export function parseSelectedFromSearch(search: string): SelectedMap {
  const params = new URLSearchParams(search)
  const selected: SelectedMap = {}
  for (const cat of CATEGORIES) {
    const val = params.get(cat)
    if (val) selected[cat] = val
  }
  return selected
}

export function applySelectedToUrl(url: URL, selected: SelectedMap) {
  // Remove existing category params first to avoid stale state
  for (const cat of CATEGORIES) url.searchParams.delete(cat)
  for (const [cat, id] of Object.entries(selected)) {
    if (id) url.searchParams.set(cat, id)
  }
}

export function serializeSelectedToUrl(selected: SelectedMap, baseHref?: string) {
  const url = new URL(baseHref ?? window.location.href)
  applySelectedToUrl(url, selected)
  return url.toString()
}
