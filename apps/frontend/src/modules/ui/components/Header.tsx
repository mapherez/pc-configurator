import ThemeToggle from './ThemeToggle'
import LanguageSwitcher from './LanguageSwitcher'
import { useI18n } from '../../i18n/i18n'
import { useSettings } from '../../settings/settings'

export default function Header() {
  const { t } = useI18n()
  const { market, settings } = useSettings()

  return (
    <header className="sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:supports-[backdrop-filter]:bg-neutral-900/70 bg-white dark:bg-neutral-900/90 border-b border-neutral-200 dark:border-neutral-800 shadow-sm">
      <div className="w-full px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="shrink-0 rounded-md bg-gradient-to-r from-sky-500 to-indigo-500 text-white px-2.5 py-1 text-sm font-semibold shadow-sm">
            {t('APP_TITLE')}
          </div>
          <nav className="hidden md:flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
            <a className="px-2 py-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition" href={`/${market.toLowerCase()}/home`}>{t('NAV_HOME')}</a>
            <a className="px-2 py-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition" href={`/${market.toLowerCase()}/build`}>{t('NAV_BUILD')}</a>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <a
            className="inline-flex items-center justify-center min-h-[40px] min-w-[40px] px-3 rounded-md border border-neutral-300 dark:border-neutral-700 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            href={settings.SETUP.gitHubPages || 'https://github.com/'}
            target="_blank"
            rel="noreferrer"
          >
            {t('NAV_GITHUB')}
          </a>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
