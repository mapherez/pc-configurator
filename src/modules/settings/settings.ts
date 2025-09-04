import { useCallback, useEffect } from 'react'
import defaultSettings from '../../../settings/default.settings.json'
import env from '../../../settings/env.json'
import type { Settings, RawMarketSettings } from './types'
import { useAppSelector, useAppDispatch } from '../../store/hooks'
import { setMarket, setSettings } from './settingsSlice'
import type { RootState } from '../../store'
import { deepMerge } from '../../utils/object'

// Import all market settings files
const marketSettingsModules = import.meta.glob<RawMarketSettings>('../../../settings/market/*.settings.json', {
  eager: true,
  import: 'default',
})

// Cache market settings for performance
const MARKET_SETTINGS = new Map<string, Settings>()

function transformRawSettings(raw: RawMarketSettings): Settings {
  return {
    ...raw,
    language: raw.language || env.language,
    currency: raw.currency || defaultSettings.currency,
  }
}

export function getMarketSettings(market: string): Settings {
  // Check cache first
  const cached = MARKET_SETTINGS.get(market)
  if (cached) return cached

  // Try to load from market-specific settings
  const marketPath = `/settings/market/${market}.settings.json`
  const rawSettings = Object.entries(marketSettingsModules).find(([path]) => path.endsWith(marketPath))?.[1]

  // First create a base settings with market's language
  // Start with default settings and env values
  const baseSettings = deepMerge(defaultSettings, {
    language: env.language,
  })

  // If we have market-specific settings, merge them on top
  const settings = rawSettings
    ? deepMerge(baseSettings, transformRawSettings(rawSettings))
    : baseSettings

  MARKET_SETTINGS.set(market, settings)
  return settings
}

export function validateSettings(settings: Settings): Settings {
  // Return a new settings object with any invalid values replaced with defaults
  return {
    language: settings.language || env.language,
    currency: settings.currency || defaultSettings.currency,
    languages: settings.languages || [env.language],
    gitHubPages: settings.gitHubPages || (defaultSettings as Settings).gitHubPages,
  }
}

export function useSettings() {
  const dispatch = useAppDispatch()
  const settings = useAppSelector((state: RootState) => state.settings.settings)
  const market = useAppSelector((state: RootState) => state.settings.market)

  // Initialize market and settings from env if not set
  useEffect(() => {
    if (market !== env.market) {
      const newSettings = getMarketSettings(env.market)
      dispatch(setMarket(env.market))
      dispatch(setSettings(newSettings))
    }
  }, [dispatch, market])

  const updateMarket = useCallback((newMarket: string) => {
    const newSettings = getMarketSettings(newMarket)
    dispatch(setMarket(newMarket))
    dispatch(setSettings(newSettings))
  }, [dispatch])

  return { settings, market, updateMarket }
}
