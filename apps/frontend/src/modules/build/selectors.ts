import type { Part } from '../catalog/schema'
import { extractSpecs, type SpecsBag, recommendedPsuWattage } from './compatibility'

export const IVA_RATE = 0.23

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
  const specs = parts.reduce<SpecsBag>((acc, p) => {
    Object.assign(acc, extractSpecs(p))
    return acc
  }, {})
  return recommendedPsuWattage(specs)
}
