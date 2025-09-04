import type { Part } from '../catalog/schema'
import { extractSpecs, type SpecsBag, recommendedPsuWattage } from './compatibility'

// Import mock data to resolve selected parts
import cpu from '../catalog/data/cpu.json'
import gpu from '../catalog/data/gpu.json'
import mobo from '../catalog/data/motherboard.json'
import ram from '../catalog/data/ram.json'
import pcCase from '../catalog/data/case.json'
import psu from '../catalog/data/psu.json'

export const IVA_RATE = 0.23

export const DATA: Record<string, Part[]> = {
  cpu: cpu as Part[],
  gpu: gpu as Part[],
  motherboard: mobo as Part[],
  ram: ram as Part[],
  case: pcCase as Part[],
  psu: psu as Part[],
}

export function indexById(list: Part[]): Record<string, Part> {
  const idx: Record<string, Part> = {}
  for (const p of list) idx[p.id] = p as Part
  return idx
}

export const INDEX: Record<string, Record<string, Part>> = Object.fromEntries(
  Object.entries(DATA).map(([k, v]) => [k, indexById(v)])
) as Record<string, Record<string, Part>>

export function getSelectedParts(selected: Partial<Record<Part['category'], string>>): Part[] {
  const result: Part[] = []
  for (const [cat, id] of Object.entries(selected)) {
    const part = INDEX[cat]?.[id as string]
    if (part) result.push(part as Part)
  }
  return result
}

export function buildSpecsFromSelection(selected: Partial<Record<Part['category'], string>>): SpecsBag {
  const bag: SpecsBag = {}
  for (const [cat, id] of Object.entries(selected)) {
    const part = INDEX[cat]?.[id as string]
    if (part) Object.assign(bag, extractSpecs(part as Part))
  }
  return bag
}

export function calcTotals(parts: Part[]) {
  const price = parts.reduce((sum, p) => sum + (p.price ?? 0), 0)
  const iva = price * IVA_RATE
  const total = price + iva
  // Derive TDP via typed specs extraction
  const bag = parts.reduce<SpecsBag>((acc, p) => {
    Object.assign(acc, extractSpecs(p))
    return acc
  }, {})
  const tdp = (bag.cpu?.tdp ?? 0) + (bag.gpu?.tdp ?? 0)
  return { price, iva, total, tdp }
}

export function recommendPsu(parts: Part[]) {
  const specs = buildSpecsFromSelection(
    Object.fromEntries(parts.map((p) => [p.category, p.id])) as Partial<
      Record<Part['category'], string>
    >
  )
  return recommendedPsuWattage(specs)
}
