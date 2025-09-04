import { z } from 'zod'

export const CategoryEnum = z.enum([
  'cpu',
  'gpu',
  'motherboard',
  'ram',
  'storage',
  'psu',
  'case',
  'cooler',
  'fan',
])

export const PartBase = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  brand: z.string(),
  category: CategoryEnum,
  price: z.number(), // EUR
  images: z.array(z.string()).default([]),
  specs: z.record(
    z.string(),
    z.union([
      z.string(),
      z.number(),
      z.boolean(),
      z.array(z.union([z.string(), z.number(), z.boolean()])),
    ])
  ),
})

export const CpuSpecs = z.object({ socket: z.string(), tdp: z.number() })
export const GpuSpecs = z.object({ length_mm: z.number(), tdp: z.number() })
export const MoboSpecs = z.object({
  socket: z.string(),
  ram_type: z.string(),
  form_factor: z.enum(['ATX', 'mATX', 'ITX']),
})
export const CaseSpecs = z.object({
  max_gpu_length_mm: z.number(),
  mobo_support: z.array(z.enum(['ATX', 'mATX', 'ITX'])),
})
export const PsuSpecs = z.object({
  wattage: z.number(),
  efficiency: z.enum(['80+ Bronze', '80+ Gold', '80+ Platinum']).optional(),
})
export const RamSpecs = z.object({
  type: z.string(),
  size_gb: z.number(),
  sticks: z.number(),
})

export type Part = z.infer<typeof PartBase>
export type CpuSpecsT = z.infer<typeof CpuSpecs>
export type GpuSpecsT = z.infer<typeof GpuSpecs>
export type MoboSpecsT = z.infer<typeof MoboSpecs>
export type CaseSpecsT = z.infer<typeof CaseSpecs>
export type PsuSpecsT = z.infer<typeof PsuSpecs>
export type RamSpecsT = z.infer<typeof RamSpecs>
