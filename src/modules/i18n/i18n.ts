import { useCallback } from 'react'
import env from '../../../settings/env.json'
import defaultLocale from '../../../settings/default.locale.json'
import defaultSettings from '../../../settings/default.settings.json'
import type { Settings, LocaleDict } from './i18nSlice'
import { useAppSelector, useAppDispatch } from '../../store/hooks'
import { setMarket, setLocale, setSettings } from './i18nSlice'

const settingsModules = import.meta.glob<Settings>('../../../settings/market/*.settings.json', {
  eager: true,
  import: 'default',
})

const localeModules = import.meta.glob<LocaleDict>('../../../settings/locale/*.json', {
  eager: true,
  import: 'default',
})

// settings path: ../../../settings/market/{market}.settings.json
// locale path:   ../../../settings/locale/{language}.json
const MARKET_SETTINGS = new Map<string, Settings>()
for (const [path, mod] of Object.entries(settingsModules)) {
  const m = /settings\/market\/(.+)\.settings\.json$/.exec(path)
  if (m) MARKET_SETTINGS.set(m[1], mod)
}

const LANGUAGE_LOCALES = new Map<string, LocaleDict>()
for (const [path, mod] of Object.entries(localeModules)) {
  const m = /settings\/locale\/(.+)\.json$/.exec(path)
  if (m) LANGUAGE_LOCALES.set(m[1], mod)
}

// Map from href to market
const MARKET_REDIRECT = new Map<string, string>()

for (const market of MARKET_SETTINGS.keys()) {
  MARKET_REDIRECT.set(`/${market.toLowerCase()}/home`, market)
  MARKET_REDIRECT.set(`/${market.toLowerCase()}/build`, market)
}

// Load resources
export function getSettings(market: string) {
  const foundSettings = MARKET_SETTINGS.get(market.toLowerCase())
  
  // If no market settings found, use default settings with env language
  if (!foundSettings) {
    return {
      settings: { ...defaultSettings, language: env.language },
      locale: LANGUAGE_LOCALES.get(env.language) ?? defaultLocale
    }
  }

  // Merge settings, giving priority to market settings
  const mergedSettings = { ...defaultSettings, ...foundSettings }
  
  // If market doesn't specify languages array, use only the env language
  if (!foundSettings.languages) {
    mergedSettings.language = env.language
    delete mergedSettings.languages
  }

  // Get locale for the active language
  const foundLocale = LANGUAGE_LOCALES.get(mergedSettings.language) ?? defaultLocale

  return { settings: mergedSettings, locale: foundLocale }
}

export function getLocale(language: string) {
  const foundLocale = LANGUAGE_LOCALES.get(language)
  return foundLocale ?? defaultLocale
}

// Try to guess market by path
export function guessMarket() {
  const pathname = location.pathname
  const _market = MARKET_REDIRECT.get(pathname)

  // If exact match found then we're happy
  if (_market) return _market

  // Otherwise try to parse first part as market code, e.g. /us/home
  const m = /^\/([a-z]{2})\//.exec(pathname)
  if (m) {
    const market = m[1].toLowerCase()
    if (MARKET_SETTINGS.has(market)) return market
  }

  // Otherwise default to env setting
  return env.market
}

export function useI18n() {
  const dispatch = useAppDispatch()
  const settings = useAppSelector((state) => state.i18n.settings)
  const locale = useAppSelector((state) => state.i18n.locale)
  const market = useAppSelector((state) => state.i18n.market)

  const t = useCallback(
    (key: string, params?: Record<string, string>) =>
      interpolate((locale as Record<string, string>)[key] ?? (defaultLocale as Record<string, string>)[key] ?? key, params),
    [locale]
  )

  const formatCurrency = useCallback(
    (value: number) => {
      return new Intl.NumberFormat(settings.language, {
        style: 'currency',
        currency: settings.currency,
        minimumFractionDigits: 2,
      }).format(value)
    },
    [settings.currency, settings.language]
  )

  const updateLocale = useCallback((language: string) => {
    const newLocale = getLocale(language)
    dispatch(setSettings({ ...settings, language }))
    dispatch(setLocale(newLocale))
  }, [dispatch, settings])

  const updateMarket = useCallback((newMarket: string) => {
    const { settings: newSettings, locale: newLocale } = getSettings(newMarket)
    dispatch(setMarket(newMarket))
    dispatch(setSettings(newSettings))
    dispatch(setLocale(newLocale))
  }, [dispatch])

  return { t, formatCurrency, market, updateLocale, updateMarket }
}

function interpolate(text: string, params?: Record<string, string>) {
  if (!params) return text
  return Object.entries(params).reduce(
    (acc, [key, value]) => acc.replace(new RegExp(`{{${key}}}`, 'g'), value),
    text
  )
}
