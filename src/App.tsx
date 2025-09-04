import { useEffect } from 'react'
import { Provider } from 'react-redux'
import PartList from './modules/ui/components/PartList'
import BuildSummary from './modules/ui/components/BuildSummary'
import Header from './modules/ui/components/Header'
import { store } from './store/index'
import { parseSelectedFromSearch } from './modules/build/share'
import { useAppDispatch } from './store/hooks'
import { setPart } from './modules/build/buildSlice'
import type { Category } from './modules/build/buildSlice'

function AppContent() {
  const dispatch = useAppDispatch()
  
  // Hydrate selection from URL on first load
  useEffect(() => {
    const initial = parseSelectedFromSearch(window.location.search)
    if (Object.keys(initial).length > 0) {
      // Dispatch actions to set initial parts
      Object.entries(initial).forEach(([category, partId]) => {
        dispatch(setPart({ category: category as Category, partId }))
      })
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
      <AppContent />
    </Provider>
  )
}

export default App
