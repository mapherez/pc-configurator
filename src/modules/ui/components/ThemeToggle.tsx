import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n/i18n'

function getInitialTheme(): 'dark' | 'light' {
  const saved = localStorage.getItem('theme') as 'dark' | 'light' | null
  if (saved) return saved
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return prefersDark ? 'dark' : 'light'
}

export default function ThemeToggle() {
  const { t } = useI18n()
  const [theme, setTheme] = useState<'dark' | 'light'>(getInitialTheme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  return (
    <button
      className="px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
      onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      aria-label={t('THEME_TOGGLE')}
      title={t('THEME_TOGGLE')}
    >
      {theme === 'dark' ? t('THEME_LIGHT') : t('THEME_DARK')}
    </button>
  )
}

