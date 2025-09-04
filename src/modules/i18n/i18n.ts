import env from '../../../settings/env.json'
import { create } from 'zustand'
import defaultSettings from '../../../settings/default.settings.json'
import defaultLocale from '../../../settings/default.locale.json'

type Settings = {
  language: string
  currency: string
  languages?: string[]
}

type LocaleDict = Record<string, string>

type Market = string

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
  if (!m) continue
  const market = m[1].toUpperCase()
  MARKET_SETTINGS.set(market, mod)
}

const LOCALES = new Map<string, LocaleDict>()
for (const [path, mod] of Object.entries(localeModules)) {
  const m = /settings\/locale\/(.+)\.json$/.exec(path)
  if (!m) continue
  const language = m[1]
  LOCALES.set(language, mod)
}

function toIntlLocale(code: string) {
  // Convert en_US -> en-US for Intl API
  return code.replace('_', '-')
}

function resolvePack(market: string, language: string) {
  const mkt = market.toUpperCase()
  const lang = language
  const foundSettings = MARKET_SETTINGS.get(mkt)
  const foundLocale = LOCALES.get(lang)
  const mergedSettings = { ...(defaultSettings as Settings), ...(foundSettings ?? {}) } as Settings
  const effectiveLocale = (foundLocale ?? (defaultLocale as LocaleDict)) as LocaleDict
  return { settings: mergedSettings, locale: effectiveLocale }
}

const LS_KEY = 'i18n.lang'

function readPersistedLang(): string | null {
  try {
    return localStorage.getItem(LS_KEY)
  } catch {
    return null
  }
}

function detectMarketFromPath(): string | null {
  try {
    const seg = (typeof window !== 'undefined' ? window.location.pathname : '').split('/').filter(Boolean)[0]
    if (seg && /^([a-z]{2})$/.test(seg)) return seg.toUpperCase()
    return null
  } catch {
    return null
  }
}

const persistedLang = readPersistedLang()
const initialLanguage = persistedLang ?? env.language ?? 'pt_PT'
const initialMarket = detectMarketFromPath() ?? (env.market ?? 'PT').toUpperCase()
const initialPack = resolvePack(initialMarket, initialLanguage)

type I18nState = {
  market: string
  language: string
  settings: Settings
  locale: LocaleDict
  setLocale: (market: string, language: string) => void
}

export const useI18nStore = create<I18nState>((set) => ({
  market: initialMarket,
  language: initialLanguage,
  settings: initialPack.settings,
  locale: initialPack.locale,
  setLocale: (_market, language) => {
    // keep current market; only change language
    set((s) => {
      const pack = resolvePack(s.market, language)
      return { market: s.market, language, settings: pack.settings, locale: pack.locale }
    })
    try {
      localStorage.setItem(LS_KEY, language)
    } catch {
      // ignore storage errors
    }
  },
}))

// Sync store when user navigates via back/forward and market segment changes
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    const mkt = detectMarketFromPath()
    if (!mkt) return
    const st = useI18nStore.getState()
    if (st.market !== mkt) {
      const pack = resolvePack(mkt, st.language)
      useI18nStore.setState({ market: mkt, language: st.language, settings: pack.settings, locale: pack.locale })
    }
  })
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name) => String(params[name] ?? ''))
}

export function useI18n() {
  const settings = useI18nStore((s) => s.settings)
  const locale = useI18nStore((s) => s.locale)
  const intlLocale = toIntlLocale(settings.language)
  return {
    t: (key: string, params?: Record<string, string | number>) =>
      interpolate((locale[key] ?? (defaultLocale as LocaleDict)[key] ?? key) as string, params),
    formatCurrency: (value: number) =>
      new Intl.NumberFormat(intlLocale, {
        style: 'currency',
        currency: settings.currency,
        maximumFractionDigits: 2,
      }).format(value),
    settings,
  }
}

// Non-hook convenience (not reactive)
export function localize(key: string, params?: Record<string, string | number>): string {
  const { locale } = useI18nStore.getState()
  return interpolate((locale[key] ?? (defaultLocale as LocaleDict)[key] ?? key) as string, params)
}

export function formatCurrency(value: number): string {
  const { settings } = useI18nStore.getState()
  const intlLocale = toIntlLocale(settings.language)
  return new Intl.NumberFormat(intlLocale, {
    style: 'currency',
    currency: settings.currency,
    maximumFractionDigits: 2,
  }).format(value)
}

export function getSettings(): Settings {
  return useI18nStore.getState().settings
}

export function getMarket(): Market {
  return useI18nStore.getState().market
}

export const setLocale = (market: string, language: string) => useI18nStore.getState().setLocale(market, language)

export function getAvailableLanguages(market?: string): string[] {
  const mkt = (market ?? useI18nStore.getState().market).toUpperCase()
  const marketSettings = MARKET_SETTINGS.get(mkt)
  if (marketSettings?.languages && marketSettings.languages.length > 0) return marketSettings.languages
  // fallback to all known locales
  return Array.from(LOCALES.keys()).sort()
}

export function getLanguageLabel(code: string): string {
  const bcp47 = code.replace('_', '-')
  // Try to use Intl.DisplayNames when available (without using `any`)
  type DisplayNamesInstance = { of(code: string): string | undefined }
  type DisplayNamesCtor = new (locale: string, options: { type: 'language' }) => DisplayNamesInstance
  const maybeIntl = (Intl as unknown) as { DisplayNames?: DisplayNamesCtor }
  const Ctor = maybeIntl.DisplayNames
  if (typeof Ctor === 'function') {
    try {
      const dn = new Ctor('en', { type: 'language' })
      const label = dn.of(bcp47)
      if (label && label !== bcp47) {
        const region = code.split('_')[1] ?? ''
        return region ? `${label} (${region})` : String(label)
      }
    } catch {
      // ignore
    }
  }
  // As requested, avoid extra fallbacks outside default files
  return code
}

export type { Settings, LocaleDict, Market }
