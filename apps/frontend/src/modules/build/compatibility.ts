import type {
  CpuSpecsT,
  MoboSpecsT,
  CaseSpecsT,
  GpuSpecsT,
  PsuSpecsT,
  Part,
} from '../catalog/schema'
import defaultLocale from '../../../settings/default.locale.json'

const t = (key: keyof typeof defaultLocale) => defaultLocale[key]

export type SpecsBag = {
  cpu?: CpuSpecsT
  mobo?: MoboSpecsT
  gpu?: GpuSpecsT
  case?: CaseSpecsT
  psu?: PsuSpecsT
  ramType?: string
}

export function isCpuMoboCompatible(cpu: CpuSpecsT, mobo: MoboSpecsT) {
  return cpu.socket === mobo.socket
}

export function isRamMoboCompatible(ramType: string, mobo: MoboSpecsT) {
  return ramType === mobo.ram_type
}

export function isGpuCaseCompatible(gpu: GpuSpecsT, pcCase: CaseSpecsT) {
  return gpu.length_mm <= pcCase.max_gpu_length_mm
}

export function isMoboCaseCompatible(mobo: MoboSpecsT, pcCase: CaseSpecsT) {
  return pcCase.mobo_support.includes(mobo.form_factor)
}

export function isPsuWattageSufficient(specs: SpecsBag) {
  const tdpTotal = (specs.cpu?.tdp ?? 0) + (specs.gpu?.tdp ?? 0)
  const margin = 0.5
  const required = Math.ceil(tdpTotal * (1 + margin))
  return (specs.psu?.wattage ?? 0) >= required
}

// Helpers to extract typed specs from a Part (from JSON)
export function extractSpecs(part: Part): SpecsBag {
  switch (part.category) {
    case 'cpu':
      return { cpu: part.specs as unknown as CpuSpecsT }
    case 'gpu':
      return { gpu: part.specs as unknown as GpuSpecsT }
    case 'motherboard':
      return { mobo: part.specs as unknown as MoboSpecsT }
    case 'case':
      return { case: part.specs as unknown as CaseSpecsT }
    case 'psu':
      return { psu: part.specs as unknown as PsuSpecsT }
    case 'ram': {
      const t = (part.specs as Record<string, unknown>).type
      return typeof t === 'string' ? { ramType: t } : {}
    }
    default:
      return {}
  }
}

export type CompatCheck = {
  ok: boolean | null // null = unknown (insufficient context)
  reasons: string[]
}

export function checkCompatibility(candidate: Part, current: SpecsBag): CompatCheck {
  const cSpec = extractSpecs(candidate)
  const reasons: string[] = []

  // Merge current + candidate overriding same category
  const merged: SpecsBag = { ...current, ...cSpec }

  let known = false
  let ok = true

  // CPU ↔ MOBO
  if (merged.cpu && merged.mobo) {
    known = true
    const cpuMobo = isCpuMoboCompatible(merged.cpu, merged.mobo)
    ok = ok && cpuMobo
    if (!cpuMobo) reasons.push(t('REASON_CPU_MOBO_SOCKET_INCOMPATIBLE'))
  }

  // RAM ↔ MOBO
  if (merged.ramType && merged.mobo) {
    known = true
    const ramOk = isRamMoboCompatible(merged.ramType, merged.mobo)
    ok = ok && ramOk
    if (!ramOk) reasons.push(t('REASON_RAM_MOBO_TYPE_INCOMPATIBLE'))
  }

  // GPU ↔ CASE (length)
  if (merged.gpu && merged.case) {
    known = true
    const gpuCase = isGpuCaseCompatible(merged.gpu, merged.case)
    ok = ok && gpuCase
    if (!gpuCase) reasons.push(t('REASON_GPU_TOO_LONG_FOR_CASE'))
  }

  // MOBO ↔ CASE (form factor)
  if (merged.mobo && merged.case) {
    known = true
    const moboCase = isMoboCaseCompatible(merged.mobo, merged.case)
    ok = ok && moboCase
    if (!moboCase) reasons.push(t('REASON_MOBO_FORM_FACTOR_NOT_SUPPORTED_BY_CASE'))
  }

  // PSU wattage w/ margin
  if (merged.psu && (merged.cpu || merged.gpu)) {
    known = true
    const psuOk = isPsuWattageSufficient(merged)
    ok = ok && psuOk
    if (!psuOk) reasons.push(t('REASON_PSU_INSUFFICIENT_WITH_MARGIN'))
  }

  return { ok: known ? ok : null, reasons }
}

export type BuildRuleResult = { rule: string; ok: boolean | null; reason?: string }

export function evaluateBuild(specs: SpecsBag): { overall: boolean | null; rules: BuildRuleResult[] } {
  const rules: BuildRuleResult[] = []

  if (specs.cpu && specs.mobo) {
    const ok = isCpuMoboCompatible(specs.cpu, specs.mobo)
    rules.push({ rule: t('RULE_CPU_MOBO_SOCKET'), ok, reason: ok ? undefined : t('REASON_SOCKETS_DIFFERENT') })
  } else {
    rules.push({ rule: t('RULE_CPU_MOBO_SOCKET'), ok: null })
  }

  if (specs.ramType && specs.mobo) {
    const ok = isRamMoboCompatible(specs.ramType, specs.mobo)
    rules.push({ rule: t('RULE_RAM_MOBO_TYPE'), ok, reason: ok ? undefined : t('REASON_RAM_TYPE_DIFFERENT') })
  } else {
    rules.push({ rule: t('RULE_RAM_MOBO_TYPE'), ok: null })
  }

  if (specs.gpu && specs.case) {
    const ok = isGpuCaseCompatible(specs.gpu, specs.case)
    rules.push({ rule: t('RULE_GPU_CASE_LENGTH'), ok, reason: ok ? undefined : t('REASON_GPU_TOO_LONG') })
  } else {
    rules.push({ rule: t('RULE_GPU_CASE_LENGTH'), ok: null })
  }

  if (specs.mobo && specs.case) {
    const ok = isMoboCaseCompatible(specs.mobo, specs.case)
    rules.push({ rule: t('RULE_MOBO_CASE_FORM_FACTOR'), ok, reason: ok ? undefined : t('REASON_FORM_FACTOR_NOT_SUPPORTED') })
  } else {
    rules.push({ rule: t('RULE_MOBO_CASE_FORM_FACTOR'), ok: null })
  }

  if (specs.psu && (specs.cpu || specs.gpu)) {
    const ok = isPsuWattageSufficient(specs)
    rules.push({ rule: t('RULE_PSU_WATTAGE'), ok, reason: ok ? undefined : t('REASON_PSU_INSUFFICIENT') })
  } else {
    rules.push({ rule: t('RULE_PSU_WATTAGE'), ok: null })
  }

  const knownRules = rules.filter((r) => r.ok !== null)
  const overall = knownRules.length === 0 ? null : knownRules.every((r) => r.ok === true)
  return { overall, rules }
}

export function recommendedPsuWattage(specs: SpecsBag): number {
  const tdpTotal = (specs.cpu?.tdp ?? 0) + (specs.gpu?.tdp ?? 0)
  const margin = 0.5
  const required = Math.ceil(tdpTotal * (1 + margin))
  // Round up to nearest 50W
  return Math.ceil(required / 50) * 50
}
