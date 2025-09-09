declare module '*.settings.json' {
  // Allow the app to import settings JSON files with the new structure
  const value: {
    SETUP?: { language?: string; currency?: string; languages?: string[]; gitHubPages?: string }
    PART_LIST?: { type?: 'button' | 'radio' | 'checkbox' }
    PART_SUMMARY?: { type?: 'button' | 'icon-button' }
    [key: string]: unknown
  }
  export default value
}

declare module '*.locale.json' {
  const value: Record<string, string>
  export default value
}

declare module '../../../settings/locale/*.json' {
  const value: Record<string, string>
  export default value
}

