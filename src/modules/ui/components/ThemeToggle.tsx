import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n/i18n'

function getInitialTheme(): 'dark' | 'light' {
  const saved = localStorage.getItem('theme') as 'dark' | 'light' | null
  if (saved) return saved
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return prefersDark ? 'dark' : 'light'
}

function SunIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className={props.className}>
      <path d="M12 3.75v1.5M12 18.75v1.5M4.81 4.81l1.06 1.06M18.13 18.13l1.06 1.06M3.75 12h1.5M18.75 12h1.5M4.81 19.19l1.06-1.06M18.13 5.87l1.06-1.06" strokeLinecap="round" />
      <circle cx="12" cy="12" r="3.25" />
    </svg>
  )
}

function MoonIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={props.className}>
      <path d="M21 12.79A9 9 0 0 1 11.21 3c-.28 0-.55.02-.82.05a.75.75 0 0 0-.33 1.36 7.5 7.5 0 1 0 9.53 9.53.75.75 0 0 0 1.36-.33c.03-.27.05-.54.05-.82Z" />
    </svg>
  )
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

  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      aria-label={t('THEME_TOGGLE')}
      title={t('THEME_TOGGLE')}
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
        isDark ? 'bg-neutral-700' : 'bg-neutral-300'
      }`}
    >
      {/* Icons on the track */}
      <SunIcon className={`pointer-events-none absolute left-1 h-4 w-4 ${isDark ? 'text-neutral-400' : 'text-yellow-500'}`} />
      <MoonIcon className={`pointer-events-none absolute right-1 h-4 w-4 ${isDark ? 'text-blue-300' : 'text-neutral-500'}`} />
      {/* Thumb */}
      <span
        className={`pointer-events-none inline-flex h-6 w-6 transform items-center justify-center rounded-full bg-white dark:bg-neutral-900 shadow ring-1 ring-black/5 transition ${
          isDark ? 'translate-x-5' : 'translate-x-1'
        }`}
      >
        {isDark ? (
          <MoonIcon className="h-4 w-4 text-blue-400" />
        ) : (
          <SunIcon className="h-4 w-4 text-yellow-500" />
        )}
      </span>
    </button>
  )
}

