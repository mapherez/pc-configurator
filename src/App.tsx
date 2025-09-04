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
import { setMarket } from './modules/settings/settingsSlice'

function AppContent() {
  const dispatch = useAppDispatch()
  
  // Hydrate selection from URL on first load
  // Hydrate selection from URL on first load
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
    const userLocale = params.get('locale') || navigator.language
    const userMarket = userLocale.split('-')[1]?.toLowerCase() || 'us'
    if (userMarket) {
      dispatch(setMarket(userMarket))
    }
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
        <AppContent />
      </I18nProvider>
    </Provider>
  )
}

export default App
