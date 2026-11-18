export type ApiCategory = {
  id: number;
  name: string;
};

export type ApiPart = {
  id: number;
  slug: string;
  sku: string;
  name: string;
  brand: string;
  price: string | number;
  images: string[];
  specs: Record<string, unknown> | null;
  category?: ApiCategory | null;
  categoryId?: number | null;
};

export function getApiBase(): string {
  return "";
}

let partsCache: Promise<ApiPart[]> | null = null;

export async function fetchParts(): Promise<ApiPart[]> {
  if (partsCache) return partsCache;
  partsCache = (async () => {
    const base = getApiBase();
    const res = await fetch(`${base}/api/parts`);
    if (!res.ok) throw new Error(`Failed to fetch parts: ${res.status}`);
    const data = (await res.json()) as ApiPart[];
    return data;
  })();
  try {
    return await partsCache;
  } catch (error) {
    partsCache = null;
    throw error;
  }
}
