import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import defaultLocale from '../../../settings/default.locale.json'
import type { Settings } from '../settings/types'

export interface I18nState {
  settings: Settings
  locale: Record<string, string>
}

const initialState: I18nState = {
  settings: { // This will be updated by useEffect below
    language: 'en-US',
    currency: 'USD',
  },
  locale: defaultLocale,
}

export const i18nSlice = createSlice({
  name: 'i18n',
  initialState,
  reducers: {
    setLocale: (state, action: PayloadAction<Record<string, string>>) => {
      state.locale = action.payload
    },
    setSettings: (state, action: PayloadAction<Settings>) => {
      state.settings = action.payload
    },
  }
})

export const { setLocale, setSettings } = i18nSlice.actions
export default i18nSlice.reducer
