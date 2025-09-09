import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import defaultLocale from '../../../settings/default.locale.json'

export interface I18nState { locale: Record<string, string> }

const initialState: I18nState = { locale: defaultLocale }

export const i18nSlice = createSlice({
  name: 'i18n',
  initialState,
  reducers: {
    setLocale: (state, action: PayloadAction<Record<string, string>>) => {
      state.locale = action.payload
    },
    // settings are managed in settings slice; i18n keeps only the resolved locale
  }
})

export const { setLocale } = i18nSlice.actions
export default i18nSlice.reducer
