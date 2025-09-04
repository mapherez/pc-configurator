import { configureStore } from '@reduxjs/toolkit'
import buildReducer from '../modules/build/buildSlice'
import i18nReducer from '../modules/i18n/i18nSlice'
import settingsReducer from '../modules/settings/settingsSlice'

export const store = configureStore({
  reducer: {
    build: buildReducer,
    i18n: i18nReducer,
    settings: settingsReducer
  }
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
