import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import defaultSettings from '../../../settings/default.settings.json'
import { loadStoredState, saveStoredState } from './storage'
import type { Settings } from './types'
import env from '../../../settings/env.json'

export interface SettingsState {
  market: string
  settings: Settings
}

// Try to load saved state or use env values
const savedState = loadStoredState()
const initialState: SettingsState = {
  market: savedState?.market ?? env.market ?? 'us',
  settings: (savedState?.settings ?? (defaultSettings as Settings)) as Settings,
}

export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setMarket: (state, action: PayloadAction<string>) => {
      state.market = action.payload
      saveStoredState({ market: state.market, settings: state.settings })
    },
    setSettings: (state, action: PayloadAction<Settings>) => {
      state.settings = action.payload
      saveStoredState({ market: state.market, settings: state.settings })
    }
  }
})

export const { setMarket, setSettings } = settingsSlice.actions
export default settingsSlice.reducer
