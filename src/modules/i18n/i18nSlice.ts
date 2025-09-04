import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import defaultLocale from '../../../settings/default.locale.json'
import defaultSettings from '../../../settings/default.settings.json'
import { loadI18nState, saveI18nState } from './storage'

export type Settings = {
  language: string
  currency: string
  languages?: string[]
}

export type LocaleDict = Record<string, string>

export interface I18nState {
  market: string
  settings: Settings
  locale: LocaleDict
}

// Try to load saved state, otherwise use defaults
const savedState = loadI18nState()
const initialState: I18nState = {
  market: savedState?.market ?? 'us',
  settings: savedState?.settings ?? defaultSettings,
  locale: defaultLocale
}

export const i18nSlice = createSlice({
  name: 'i18n',
  initialState,
  reducers: {
    setMarket: (state, action: PayloadAction<string>) => {
      state.market = action.payload
      saveI18nState({ market: state.market, settings: state.settings })
    },
    setLocale: (state, action: PayloadAction<Record<string, string>>) => {
      state.locale = action.payload
    },
    setSettings: (state, action: PayloadAction<I18nState['settings']>) => {
      state.settings = action.payload
      saveI18nState({ market: state.market, settings: state.settings })
    }
  }
})

export const { setMarket, setLocale, setSettings } = i18nSlice.actions
export default i18nSlice.reducer
