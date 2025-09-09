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
  const base: Settings = defaultSettings as Settings
  return {
    ...base,
    ...raw,
    SETUP: {
      ...base.SETUP,
      ...(raw.SETUP || {}),
      language: raw.SETUP?.language || env.language,
      currency: raw.SETUP?.currency || base.SETUP.currency,
      languages: raw.SETUP?.languages || base.SETUP.languages || [env.language],
      gitHubPages: raw.SETUP?.gitHubPages || base.SETUP.gitHubPages,
    },
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
  const baseSettings = deepMerge(defaultSettings as Settings, {
    SETUP: { language: env.language },
  })

  // If we have market-specific settings, merge them on top
  const settings = validateSettings(rawSettings
    ? deepMerge(baseSettings, transformRawSettings(rawSettings))
    : baseSettings)

  MARKET_SETTINGS.set(market, settings)
  return settings
}

export function validateSettings(settings: Settings): Settings {
  // Return a new settings object with any invalid values replaced with defaults, preserving unknown keys
  const defaults = defaultSettings as Settings
  return {
    ...settings,
    SETUP: {
      language: settings.SETUP?.language || env.language,
      currency: settings.SETUP?.currency || defaults.SETUP.currency,
      languages: settings.SETUP?.languages || [env.language],
      gitHubPages: settings.SETUP?.gitHubPages || defaults.SETUP.gitHubPages,
    },
    PART_LIST: {
      type: settings.PART_LIST?.type || defaults.PART_LIST?.type || 'radio',
    },
    PART_SUMMARY: {
      type: settings.PART_SUMMARY?.type || defaults.PART_SUMMARY?.type || 'icon-button',
    },
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
