import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import defaultLocale from '../../../settings/default.locale.json'
import defaultSettings from '../../../settings/default.settings.json'

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

const initialState: I18nState = {
  market: 'US',
  settings: defaultSettings,
  locale: defaultLocale
}

export const i18nSlice = createSlice({
  name: 'i18n',
  initialState,
  reducers: {
    setMarket: (state, action: PayloadAction<string>) => {
      state.market = action.payload
    },
    setLocale: (state, action: PayloadAction<Record<string, string>>) => {
      state.locale = action.payload
    },
    setSettings: (state, action: PayloadAction<I18nState['settings']>) => {
      state.settings = action.payload
    }
  }
})

export const { setMarket, setLocale, setSettings } = i18nSlice.actions
export default i18nSlice.reducer
