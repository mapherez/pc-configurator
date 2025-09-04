import { useEffect } from 'react'
import PartList from './modules/ui/components/PartList'
import BuildSummary from './modules/ui/components/BuildSummary'
import Header from './modules/ui/components/Header'
import { useBuildStore } from './modules/build/store'
import { parseSelectedFromSearch } from './modules/build/share'

function App() {
  // Hydrate selection from URL on first load
  useEffect(() => {
    const initial = parseSelectedFromSearch(window.location.search)
    if (Object.keys(initial).length > 0) {
      // Merge into store
      useBuildStore.setState((s) => ({ ...s, selected: { ...s.selected, ...initial } }))
    }
  }, [])

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

export default App
