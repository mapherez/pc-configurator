import type { ChangeEvent } from 'react'
import { useAppDispatch, useAppSelector } from '../../../store/hooks'
import type { RootState } from '../../../store/index'
import { setSettings as setGlobalSettings } from '../../settings/settingsSlice'
import { useI18n } from '../../i18n/i18n'

export default function LanguageSwitcher() {
  const { t } = useI18n()
  const dispatch = useAppDispatch()
  const settings = useAppSelector((state: RootState) => state.settings.settings)
  
  // Don't render if no language options available
  if (!settings.languages?.length) {
    return null
  }

  const options = settings.languages.map((code: string) => {
    const override = t(`LANG_NAME_${code}`)
    const label = override !== `LANG_NAME_${code}`
      ? override
      : new Intl.DisplayNames([settings.language], { type: 'language' }).of(code) ?? code
    return { value: code, label }
  })

  function onChange(e: ChangeEvent<HTMLSelectElement>) {
    const lang = e.target.value
    // Update global settings.language; I18nProvider syncs the locale strings
    dispatch(setGlobalSettings({ ...settings, language: lang }))
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
