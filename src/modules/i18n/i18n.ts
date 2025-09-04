import { useMemo } from 'react'
import { useCallback, useEffect } from 'react'
import defaultLocale from '../../../settings/default.locale.json'
import type { LocaleDict } from '../settings/types'
import { useAppSelector, useAppDispatch } from '../../store/hooks'
import { setLocale } from './i18nSlice'

// Import all locale files
const localeModules = import.meta.glob<LocaleDict>('../../../settings/locale/*.json', {
  eager: true,
  import: 'default',
})

// settings path: ../../../settings/market/{market}.settings.json
// locale path:   ../../../settings/locale/{language}.json
const LANGUAGE_LOCALES = new Map<string, LocaleDict>()
for (const [path, mod] of Object.entries(localeModules)) {
  const m = /settings\/locale\/(.+)\.json$/.exec(path)
  if (m) LANGUAGE_LOCALES.set(m[1], mod)
}

export function getLocale(language: string): LocaleDict {
  const foundLocale = LANGUAGE_LOCALES.get(language)
  // For locale files, simple merge is enough since it's just key-value pairs
  return foundLocale ? { ...defaultLocale, ...foundLocale } : defaultLocale
}

export function useI18n() {
  const dispatch = useAppDispatch()
  // Source language/currency from global settings slice
  const settings = useAppSelector((state) => state.settings.settings)
  const locale = useAppSelector((state) => state.i18n.locale)

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      interpolate(
        (locale as Record<string, string>)[key] ?? (defaultLocale as Record<string, string>)[key] ?? key,
        params
      ),
    [locale]
  )

  const numberFormat = useMemo(() => new Intl.NumberFormat(settings.language), [settings.language])
  const currencyFormat = useMemo(
    () =>
      new Intl.NumberFormat(settings.language, {
        style: 'currency',
        currency: settings.currency,
        minimumFractionDigits: 2,
      }),
    [settings.currency, settings.language]
  )

  const formatCurrency = useCallback((value: number) => currencyFormat.format(value), [currencyFormat])
  const formatNumber = useCallback((value: number) => numberFormat.format(value), [numberFormat])

  const tn = useCallback(
    (key: string, count: number, params?: Record<string, string | number>) => {
      const plural = new Intl.PluralRules(settings.language).select(count)
      const keyVariant = `${key}_${plural}`
      const template =
        (locale as Record<string, string>)[keyVariant] ??
        (defaultLocale as Record<string, string>)[keyVariant] ??
        (locale as Record<string, string>)[key] ??
        (defaultLocale as Record<string, string>)[key] ??
        keyVariant
      const mergedParams: Record<string, string | number> = {
        count: numberFormat.format(count),
        ...(params ?? {}),
      }
      return interpolate(template, mergedParams)
    },
    [locale, settings.language, numberFormat]
  )

  const updateLocale = useCallback((language: string) => {
    const newLocale = getLocale(language)
    dispatch(setLocale(newLocale))
  }, [dispatch])

  // Keep locale in sync with current settings.language
  useEffect(() => {
    if (!settings?.language) return
    const newLocale = getLocale(settings.language)
    dispatch(setLocale(newLocale))
  }, [dispatch, settings?.language])

  return { t, tn, formatCurrency, formatNumber, updateLocale }
}

function interpolate(text: string, params?: Record<string, string | number>) {
  if (!params) return text
  return Object.entries(params).reduce(
    (acc, [key, value]) => acc.replace(new RegExp(`{{${key}}}`, 'g'), String(value)),
    text
  )
}
