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
    const merged = { ...baseSettings, ...(localeParam ? { language: localeParam } : {}) }
    dispatch(setSettings(merged))
  }, [dispatch])

  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid grid-cols-[1fr_360px] gap-4">
          <div>
            <PartList />
          </div>
          <div>
            <BuildSummary />
          </div>
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
          <AppContent />
        </UrlSyncProvider>
      </I18nProvider>
    </Provider>
  )
}

export default App
