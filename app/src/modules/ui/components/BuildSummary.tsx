import { useMemo } from 'react'
import { useBuildStore } from '../../build/store'
import {
  calcTotals,
  getSelectedParts,
  buildSpecsFromSelection,
  recommendPsu,
} from '../../build/selectors'
import { evaluateBuild } from '../../build/compatibility'
import type { Part } from '../../catalog/schema'
import { serializeSelectedToUrl } from '../../build/share'
import { useI18n } from '../../i18n/i18n'

export default function BuildSummary() {
  const { t, formatCurrency } = useI18n()
  const selected = useBuildStore((s) => s.selected)
  const removePart = useBuildStore((s) => s.removePart)
  const reset = useBuildStore((s) => s.reset)

  const parts = useMemo(() => getSelectedParts(selected), [selected])
  const totals = useMemo(() => calcTotals(parts), [parts])
  const specs = useMemo(() => buildSpecsFromSelection(selected), [selected])
  const compat = useMemo(() => evaluateBuild(specs), [specs])
  const psuRecommended = useMemo(() => recommendPsu(parts), [parts])
  const shareUrl = useMemo(() => serializeSelectedToUrl(selected, window.location.href), [selected])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
    } catch {}
  }

  return (
    <section className="border border-neutral-300 dark:border-neutral-700 rounded-lg p-4">
      <header className="flex items-center justify-between">
        <h2 className="m-0">{t('BUILD_SUMMARY')}</h2>
        <button onClick={reset}>{t('CLEAR_BUILD')}</button>
      </header>

      <div className="mt-3">
        {parts.length === 0 ? (
          <div className="opacity-70">{t('NO_PARTS')}</div>
        ) : (
          <ul className="list-none p-0 m-0">
            {parts.map((p) => (
              <li key={p.id} className="flex justify-between py-1.5">
                <div>
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-xs opacity-75">
                    {p.brand} · {p.category} · {p.sku}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="min-w-[96px] text-right">{formatCurrency(p.price)}</div>
                  <button onClick={() => removePart(p.category as Part['category'])}>{t('REMOVE')}</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <hr className="border-neutral-300 dark:border-neutral-700 my-3" />

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

      <hr className="border-neutral-300 dark:border-neutral-700 my-3" />

      <div>
        <div className="flex items-center gap-2 mb-2">
          <strong>{t('OVERALL_COMPAT')}</strong>
          <span
            className={`text-xs px-2 py-0.5 rounded-full border border-neutral-300 dark:border-neutral-700 ${
              compat.overall === null
                ? 'bg-transparent'
                : compat.overall
                ? 'bg-emerald-500/10'
                : 'bg-red-500/10'
            }`}
          >
            {compat.overall === null ? '—' : compat.overall ? t('COMPATIBLE') : t('INCOMPATIBLE')}
          </span>
        </div>
        <ul className="list-none p-0 m-0">
          {compat.rules.map((r) => (
            <li key={r.rule} className="flex justify-between py-1">
              <div>{r.rule}</div>
              <div
                title={r.reason}
                className={`text-xs px-2 py-0.5 rounded-full border border-neutral-300 dark:border-neutral-700 ${
                  r.ok === null ? 'bg-transparent' : r.ok ? 'bg-emerald-500/10' : 'bg-red-500/10'
                }`}
              >
                {r.ok === null ? '—' : r.ok ? t('OK') : t('FAIL')}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <hr className="border-neutral-300 dark:border-neutral-700 my-3" />

      <div>
        <div className="mb-1.5 font-semibold">{t('SHARE_BUILD')}</div>
        <div className="flex gap-2">
          <input
            value={shareUrl}
            readOnly
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 px-2 py-1 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
          />
          <button onClick={copyLink}>{t('COPY_LINK')}</button>
        </div>
      </div>
    </section>
  )
}

