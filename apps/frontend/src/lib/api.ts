export type ApiCategory = {
  id: number
  name: string
}

export type ApiPart = {
  id: number
  slug: string
  sku: string
  name: string
  brand: string
  price: string | number
  images: string[]
  specs: Record<string, unknown> | null
  category?: ApiCategory | null
  categoryId?: number | null
}

export function getApiBase(): string {
  const envBase = (import.meta as ImportMeta).env?.VITE_API_BASE as string | undefined
  if (envBase && envBase.length > 0) return envBase.replace(/\/$/, '')
  // Dev convenience: if running via Vite default port, target local server
  if (typeof window !== 'undefined' && window.location?.port === '5173') return 'http://localhost:3001'
  // Default to relative (useful when behind same-origin reverse proxy)
  return ''
}

let partsCache: Promise<ApiPart[]> | null = null

export async function fetchParts(): Promise<ApiPart[]> {
  if (partsCache) return partsCache
  partsCache = (async () => {
    const base = getApiBase()
    const res = await fetch(`${base}/api/parts`)
    if (!res.ok) throw new Error(`Failed to fetch parts: ${res.status}`)
    const data = (await res.json()) as ApiPart[]
    return data
  })()
  return partsCache
}
