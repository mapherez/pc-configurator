import type { ChangeEvent } from 'react'
import { useI18n } from '../../i18n/i18n'
import { useAppSelector } from '../../../store/hooks'
import type { RootState } from '../../../store/index'

export default function LanguageSwitcher() {
  const { updateLocale } = useI18n()
  const settings = useAppSelector((state: RootState) => state.i18n.settings)
  const availableLanguages = settings.languages ?? []
  const options = availableLanguages.map((code: string) => ({ 
    value: code, 
    label: new Intl.DisplayNames([settings.language], { type: 'language' }).of(code) ?? code 
  }))

  function onChange(e: ChangeEvent<HTMLSelectElement>) {
    const lang = e.target.value
    updateLocale(lang)
  }

  return (
    <select
      value={settings.language}
      onChange={onChange}
      className="px-2 py-1 rounded-md border border-neutral-300 dark:border-neutral-700 text-sm bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
      aria-label="Language"
    >
      {options.map((opt: { value: string; label: string }) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}
