import type { PartListSettings, PartSummarySettings } from '../../types/app-settings'

export interface SetupSettings {
  language: string
  currency: string
  languages?: string[]
  gitHubPages?: string
}

export interface ComponentSettings {
  showButton?: boolean
  showPrices?: boolean
  // Add other component-specific settings
}

export interface Settings {
  SETUP: SetupSettings
  // Part list/summary controls
  PART_LIST?: PartListSettings
  PART_SUMMARY?: PartSummarySettings
  // Component settings
  HEADER?: ComponentSettings
  FOOTER?: ComponentSettings
  // Add other component sections as needed
}

export type LocaleDict = Record<string, string>

export interface MarketSettings {
  name: string
  settings: Settings
  locale: LocaleDict
}

export interface StoredState {
  market: string
  settings: Settings
}

// Types for raw settings files
export interface RawMarketSettings {
  name?: string
  SETUP?: SetupSettings
  PART_LIST?: PartListSettings
  PART_SUMMARY?: PartSummarySettings
  // Component settings as they appear in the file
  HEADER?: ComponentSettings
  FOOTER?: ComponentSettings
  // Add other sections as needed
}

/** Type for default settings from default.settings.json */
export type DefaultSettings = Settings;
