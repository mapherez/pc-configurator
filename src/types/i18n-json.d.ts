declare module '*.settings.json' {
  const value: { language: string; currency: string; languages?: string[] }
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

