import { useEffect } from 'react'
import { Provider } from 'react-redux'
import I18nProvider from './modules/i18n/I18nProvider'
import PartList from './modules/ui/components/PartList'
import BuildSummary from './modules/ui/components/BuildSummary'
import Header from './modules/ui/components/Header'
import { store } from './store/index'
import { parseSelectedFromSearch } from './modules/build/share'
import { useAppDispatch } from './store/hooks'
import { setPart } from './modules/build/buildSlice'
import type { Category } from './modules/build/buildSlice'
import { setMarket, setSettings } from './modules/settings/settingsSlice'
import { getMarketSettings } from './modules/settings/settings'
import UrlSyncProvider from './modules/app/UrlSyncProvider'
import { CatalogProvider } from './modules/catalog/CatalogContext'

function AppContent() {
  const dispatch = useAppDispatch()
  
  // Hydrate selection and settings from URL on first load
  useEffect(() => {
    // Load initial state from URL params
    const initial = parseSelectedFromSearch(window.location.search)
    if (Object.keys(initial).length > 0) {
      // Dispatch actions to set initial parts
      Object.entries(initial).forEach(([category, partId]) => {
        dispatch(setPart({ category: category as Category, partId }))
      })
    }

    // Load initial market/settings from URL or browser locale
    const params = new URLSearchParams(window.location.search)
    const localeParam = params.get('locale') || undefined
    const marketParam = params.get('market') || undefined

    const navLang = navigator.language
    const defaultMarket = navLang.split('-')[1]?.toLowerCase() || 'us'
    const market = (marketParam || defaultMarket)
    dispatch(setMarket(market))
    const baseSettings = getMarketSettings(market)
    const merged = localeParam ? { ...baseSettings, SETUP: { ...baseSettings.SETUP, language: localeParam } } : baseSettings
    dispatch(setSettings(merged))
  }, [dispatch])

  return (
    <div className="h-screen flex flex-col bg-gradient-to-b from-white to-neutral-50 dark:from-neutral-900 dark:to-neutral-950 text-neutral-900 dark:text-neutral-100 antialiased leading-relaxed text-[15px] sm:text-base">
      <Header />
      <main className="p-4 flex-1 overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-stretch gap-8 h-full">
          <section className="min-w-0 w-full lg:w-[600px] h-full">
            <PartList />
          </section>
          <aside className="min-w-0 w-full lg:w-[400px] h-full overflow-auto thin-scrollbar">
            <BuildSummary />
          </aside>
        </div>
      </main>
    </div>
  )
}

function App() {
  return (
    <Provider store={store}>
      <I18nProvider>
        <UrlSyncProvider>
          <CatalogProvider>
            <AppContent />
          </CatalogProvider>
        </UrlSyncProvider>
      </I18nProvider>
    </Provider>
  )
}

export default App
