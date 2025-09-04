import { create } from 'zustand'
import { CategoryEnum } from '../catalog/schema'
import type { z } from 'zod'

type Category = z.infer<typeof CategoryEnum>

type SelectedParts = Partial<Record<Category, string>>

interface BuildState {
  mode: 'IMAGE' | 'R3F'
  selected: SelectedParts
  totals: { price: number; tdp: number }
  setPart: (category: Category, partId: string) => void
  removePart: (category: Category) => void
  reset: () => void
}

export const useBuildStore = create<BuildState>()((set) => ({
  mode: 'IMAGE',
  selected: {},
  totals: { price: 0, tdp: 0 },
  setPart: (category, partId) =>
    set((state) => ({ selected: { ...state.selected, [category]: partId } })),
  removePart: (category) =>
    set((state) => {
      const rest = { ...state.selected }
      delete rest[category]
      return { selected: rest }
    }),
  reset: () => set({ selected: {}, totals: { price: 0, tdp: 0 } }),
}))
