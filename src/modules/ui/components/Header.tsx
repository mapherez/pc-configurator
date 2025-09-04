import ThemeToggle from './ThemeToggle'
import LanguageSwitcher from './LanguageSwitcher'
import { useI18n } from '../../i18n/i18n'
import { useAppDispatch } from '../../../store/hooks'
import { reset } from '../../build/buildSlice'
import { useSettings } from '../../settings/settings'

export default function Header() {
  const dispatch = useAppDispatch()
  const { t } = useI18n()
  const { market, settings } = useSettings()
  const resetAction = () => dispatch(reset())

  return (
    <header className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-neutral-900/60 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="font-semibold">{t('APP_TITLE')}</div>
          <nav className="hidden sm:flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
            <a className="hover:underline" href={`/${market.toLowerCase()}/home`}>{t('NAV_HOME')}</a>
            <a className="hover:underline" href={`/${market.toLowerCase()}/build`}>{t('NAV_BUILD')}</a>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <a
            className="px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
            href={settings.gitHubPages || 'https://github.com/'}
            target="_blank"
            rel="noreferrer"
          >
            {t('NAV_GITHUB')}
          </a>
          <button
            onClick={resetAction}
            className="px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            {t('CLEAR_BUILD')}
          </button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
