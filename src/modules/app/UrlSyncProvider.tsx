import { type PropsWithChildren, useEffect, useRef } from 'react'
import { useAppSelector } from '../../store/hooks'
import { applySelectedToUrl } from '../build/share'

export default function UrlSyncProvider({ children }: PropsWithChildren) {
  const selected = useAppSelector((s) => s.build.selected)
  const market = useAppSelector((s) => s.settings.market)
  const language = useAppSelector((s) => s.settings.settings.language)

  const didInitial = useRef(false)

  useEffect(() => {
    const url = new URL(window.location.href)

    // Always sync locale/market
    if (language) url.searchParams.set('locale', language)
    if (market) url.searchParams.set('market', market)

    // Guard on first run to not wipe existing selection in URL if state is empty
    const params = new URLSearchParams(window.location.search)
    const hasCategoryParam = Array.from(params.keys()).some((k) => ['cpu','gpu','motherboard','ram','case','psu'].includes(k))
    const isEmpty = Object.keys(selected).length === 0

    if (!didInitial.current) {
      didInitial.current = true
      if (isEmpty && hasCategoryParam) {
        // Keep existing category params; only update locale/market
        window.history.replaceState(null, '', url)
        return
      }
    }

    // Sync selected parts into URL
    applySelectedToUrl(url, selected)
    window.history.replaceState(null, '', url)
  }, [selected, market, language])

  return <>{children}</>
}

