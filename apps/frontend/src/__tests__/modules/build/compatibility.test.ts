import { describe, it, expect } from 'vitest'
import {
  isCpuMoboCompatible,
  isRamMoboCompatible,
  isGpuCaseCompatible,
  isMoboCaseCompatible,
  isPsuWattageSufficient,
  checkCompatibility,
  evaluateBuild,
  recommendedPsuWattage,
  type SpecsBag,
} from '../../../modules/build/compatibility'
import type { Part } from '../../../modules/catalog/schema'

describe('compatibility rules', () => {
  it('CPU ↔ MOBO socket', () => {
    expect(
      isCpuMoboCompatible(
        { socket: 'AM5', tdp: 120 },
        { socket: 'AM5', ram_type: 'DDR5', form_factor: 'ATX' }
      )
    ).toBe(true)
    expect(
      isCpuMoboCompatible(
        { socket: 'AM5', tdp: 120 },
        { socket: 'LGA1700', ram_type: 'DDR5', form_factor: 'ATX' }
      )
    ).toBe(false)
  })

  it('RAM ↔ MOBO type', () => {
    expect(
      isRamMoboCompatible('DDR5', {
        socket: 'AM5',
        ram_type: 'DDR5',
        form_factor: 'ATX',
      })
    ).toBe(true)
    expect(
      isRamMoboCompatible('DDR4', {
        socket: 'AM5',
        ram_type: 'DDR5',
        form_factor: 'ATX',
      })
    ).toBe(false)
  })

  it('GPU ↔ CASE length', () => {
    expect(
      isGpuCaseCompatible({ length_mm: 300, tdp: 220 }, { max_gpu_length_mm: 320, mobo_support: ['ATX'] })
    ).toBe(true)
    expect(
      isGpuCaseCompatible({ length_mm: 330, tdp: 220 }, { max_gpu_length_mm: 320, mobo_support: ['ATX'] })
    ).toBe(false)
  })

  it('MOBO ↔ CASE form factor', () => {
    expect(
      isMoboCaseCompatible(
        { socket: 'AM5', ram_type: 'DDR5', form_factor: 'mATX' },
        { max_gpu_length_mm: 360, mobo_support: ['ATX', 'mATX'] }
      )
    ).toBe(true)
    expect(
      isMoboCaseCompatible(
        { socket: 'AM5', ram_type: 'DDR5', form_factor: 'ITX' },
        { max_gpu_length_mm: 360, mobo_support: ['ATX', 'mATX'] }
      )
    ).toBe(false)
  })

  it('PSU wattage with margin', () => {
    const specs: SpecsBag = {
      cpu: { socket: 'AM5', tdp: 120 },
      gpu: { length_mm: 300, tdp: 220 },
      psu: { wattage: 500, efficiency: '80+ Gold' },
    }
    // tdpTotal = 340; required = ceil(340*1.5)=510
    expect(isPsuWattageSufficient(specs)).toBe(false)
    specs.psu = { wattage: 650 }
    expect(isPsuWattageSufficient(specs)).toBe(true)
  })

  it('checkCompatibility aggregates reasons', () => {
    const current: SpecsBag = {
      cpu: { socket: 'AM5', tdp: 120 },
      mobo: { socket: 'AM5', ram_type: 'DDR5', form_factor: 'ATX' },
    }
    const gpu: Part = {
      id: 'gpu-1',
      sku: 'X',
      name: 'GPU',
      brand: 'B',
      category: 'gpu' as const,
      price: 1,
      images: [],
      specs: { length_mm: 400, tdp: 220 },
    }
    const pcCase: Part = {
      id: 'case-1',
      sku: 'Y',
      name: 'CASE',
      brand: 'C',
      category: 'case' as const,
      price: 1,
      images: [],
      specs: { max_gpu_length_mm: 360, mobo_support: ['ATX'] },
    }
    const r1 = checkCompatibility(gpu, current)
    expect(r1.ok === null || typeof r1.ok === 'boolean').toBe(true)
    const r2 = checkCompatibility(pcCase, { ...current, gpu: { length_mm: 400, tdp: 220 } })
    expect(r2.ok).toBe(false)
    expect(r2.reasons.join(' ')).toMatch(/GPU demasiado longa/)
  })

  it('evaluateBuild + recommendedPsuWattage', () => {
    const specs: SpecsBag = {
      cpu: { socket: 'AM5', tdp: 120 },
      gpu: { length_mm: 300, tdp: 220 },
      mobo: { socket: 'AM5', ram_type: 'DDR5', form_factor: 'ATX' },
      case: { max_gpu_length_mm: 360, mobo_support: ['ATX'] },
      psu: { wattage: 700 },
      ramType: 'DDR5',
    }
    const result = evaluateBuild(specs)
    expect(result.overall).toBe(true)
    expect(result.rules.filter((r) => r.ok === false)).toHaveLength(0)
    // tdpTotal=340 -> required=510 -> nearest 50 => 550
    expect(recommendedPsuWattage(specs)).toBe(550)
  })
})

