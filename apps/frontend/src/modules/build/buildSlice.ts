import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { CategoryEnum } from '../catalog/schema'
import type { z } from 'zod'

export type Category = z.infer<typeof CategoryEnum>
type SelectedParts = Partial<Record<Category, string>>

interface BuildState {
  mode: 'IMAGE' | 'R3F'
  selected: SelectedParts
  totals: { price: number; tdp: number }
}

const initialState: BuildState = {
  mode: 'IMAGE',
  selected: {},
  totals: { price: 0, tdp: 0 }
}

export const buildSlice = createSlice({
  name: 'build',
  initialState,
  reducers: {
    setPart: (state, action: PayloadAction<{ category: Category; partId: string }>) => {
      const { category, partId } = action.payload
      state.selected[category] = partId
    },
    removePart: (state, action: PayloadAction<{ category: Category }>) => {
      const { category } = action.payload
      delete state.selected[category]
    },
    reset: (state) => {
      state.selected = {}
      state.totals = { price: 0, tdp: 0 }
    }
  }
})

export const { setPart, removePart, reset } = buildSlice.actions
export default buildSlice.reducer
