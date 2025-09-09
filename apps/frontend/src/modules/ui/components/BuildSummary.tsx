import { useMemo } from 'react'
import { useAppDispatch, useAppSelector } from '../../../store/hooks'
import { removePart, reset, type Category } from '../../build/buildSlice'
import { calcTotals, getSelectedParts, buildSpecsFromSelection, recommendPsu } from '../../build/selectors'
import { evaluateBuild } from '../../build/compatibility'
import type { Part } from '../../catalog/schema'
import { serializeSelectedToUrl } from '../../build/share'
import { useI18n } from '../../i18n/i18n'
import { useSettings } from '../../settings/settings'
import { X, Copy, ExternalLink, Check, HelpCircle } from 'lucide-react'

export default function BuildSummary() {
  const { t, formatCurrency } = useI18n()
  const dispatch = useAppDispatch()
  const selected = useAppSelector((state) => state.build.selected)
  const removePartAction = (category: Category) => dispatch(removePart({ category }))
  const resetAction = () => dispatch(reset())

  const parts = useMemo<Part[]>(() => getSelectedParts(selected), [selected])
  const totals = useMemo(() => calcTotals(parts), [parts])
  const specs = useMemo(() => buildSpecsFromSelection(selected), [selected])
  const compat = useMemo(() => evaluateBuild(specs), [specs])
  const psuRecommended = useMemo(() => recommendPsu(parts), [parts])
  const shareUrl = useMemo(() => serializeSelectedToUrl(selected, window.location.href), [selected])
  const { settings } = useSettings()
  const removeType = settings.PART_SUMMARY?.type ?? 'button'

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
    } catch {
      // Intentionally ignore copy errors
    }
  }

  return (
    <section className="h-full rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 shadow-sm p-6 flex flex-col">
      <header className="flex items-center justify-between">
        <h2 className="m-0 text-lg font-semibold tracking-tight">{t('BUILD_SUMMARY')}</h2>
        <button
          onClick={resetAction}
          className="px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          {t('CLEAR_BUILD')}
        </button>
      </header>

      <div className="mt-3 flex-1 min-h-0 overflow-y-auto thin-scrollbar">
        {parts.length === 0 ? (
          <div className="opacity-70">{t('NO_PARTS')}</div>
        ) : (
          <ul className="list-none p-0 m-0">
            {parts.map((p) => (
              <li key={p.id} className="flex justify-between gap-3 py-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{p.name}</div>
                  <div className="text-xs text-neutral-600 dark:text-neutral-300 opacity-90 truncate">
                    {p.brand} • {p.category} • {p.sku}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="min-w-[96px] text-right font-medium">{formatCurrency(p.price)}</div>
                  {removeType === 'icon-button' ? (
                    <button
                      onClick={() => removePartAction(p.category as Category)}
                      aria-label={t('REMOVE')}
                      title={t('REMOVE')}
                      className="grid place-items-center h-10 w-10 rounded-md border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  ) : removeType === 'button' ? (
                    <button
                      onClick={() => removePartAction(p.category as Category)}
                      aria-label={t('REMOVE')}
                      title={t('REMOVE')}
                      className="px-3 h-10 rounded-md border border-neutral-300 dark:border-neutral-700 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                    >
                      X
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-auto">
        <hr className="border-neutral-200 dark:border-neutral-800 my-3" />
        {parts.length > 0 && (
          <>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <strong>{t('OVERALL_COMPAT')}</strong>
                {compat.overall === null ? (
                  <span className="text-neutral-500 rounded-full h-6 w-6 grid place-items-center">
                    <HelpCircle className="h-4 w-4" aria-hidden />
                  </span>
                ) : (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border border-neutral-300 dark:border-neutral-700 ${
                      compat.overall
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-red-500/10 text-red-600 dark:text-red-400'
                    }`}
                  >
                    {compat.overall ? t('COMPATIBLE') : t('INCOMPATIBLE')}
                  </span>
                )}
              </div>
              <ul className="list-none p-0 m-0">
                {compat.rules.map((r) => (
                  <li key={r.rule} className="flex justify-between py-1">
                    <div>{r.rule}</div>
                <div
                  title={r.reason}
                  className={`${
                    r.ok === null
                      ? 'text-neutral-500'
                      : r.ok
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  } ${r.ok === null ? 'border-0' : 'border border-neutral-300 dark:border-neutral-700'} rounded-full h-6 w-6 grid place-items-center`}
                >
                  {r.ok === null ? (
                    <HelpCircle className="h-4 w-4" aria-hidden />
                  ) : r.ok ? (
                    <Check className="h-4 w-4" aria-hidden />
                  ) : (
                    <X className="h-4 w-4" aria-hidden />
                  )}
                </div>
                  </li>
                ))}
              </ul>
            </div>
            <hr className="border-neutral-200 dark:border-neutral-800 my-3" />
          </>
        )}

        <div className="grid grid-cols-[1fr_auto] gap-y-1">
          <div>{t('SUBTOTAL')}</div>
          <div>{formatCurrency(totals.price)}</div>
          <div>{t('VAT_23')}</div>
          <div>{formatCurrency(totals.iva)}</div>
          <div>{t('TOTAL')}</div>
          <div>{formatCurrency(totals.total)}</div>
          <div>{t('TDP_ESTIMATE')}</div>
          <div>{totals.tdp} W</div>
          <div>{t('PSU_RECOMMENDED')}</div>
          <div>{psuRecommended} W</div>
        </div>

        <hr className="border-neutral-200 dark:border-neutral-800 my-3" />

        <div>
          <div className="mb-1.5 font-semibold">{t('SHARE_BUILD')}</div>
          <div className="flex gap-2">
            <input
              value={shareUrl}
              readOnly
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 h-10 px-2.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            />
            <button
              onClick={copyLink}
              aria-label={t('COPY_LINK')}
              title={t('COPY_LINK')}
              className="grid place-items-center h-10 w-10 rounded-md border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <Copy className="h-4 w-4" aria-hidden />
            </button>
            <button
              onClick={() => window.open(shareUrl, '_blank', 'noopener,noreferrer')}
              aria-label={t('OPEN')}
              title={t('OPEN')}
              className="grid place-items-center h-10 w-10 rounded-md border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
