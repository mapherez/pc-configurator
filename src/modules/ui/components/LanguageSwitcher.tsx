import { setLocale, useI18nStore, getAvailableLanguages, getLanguageLabel } from '../../i18n/i18n'
import type { ChangeEvent } from 'react'

export default function LanguageSwitcher() {
  const market = useI18nStore((s) => s.market)
  const language = useI18nStore((s) => s.language)
  const options = getAvailableLanguages(market).map((code) => ({ value: code, label: getLanguageLabel(code) }))

  function onChange(e: ChangeEvent<HTMLSelectElement>) {
    const lang = e.target.value
    setLocale(market, lang)
  }

  return (
    <select
      value={language}
      onChange={onChange}
      className="px-2 py-1 rounded-md border border-neutral-300 dark:border-neutral-700 text-sm bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
      aria-label="Language"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}
