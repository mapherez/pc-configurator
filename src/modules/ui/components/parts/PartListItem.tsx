import type { Part } from '../../../catalog/schema'
import { useI18n } from '../../../i18n/i18n'
import { checkCompatibility, type SpecsBag } from '../../../build/compatibility'
import { useAppDispatch, useAppSelector } from '../../../../store/hooks'
import { setPart, removePart } from '../../../build/buildSlice'
import { useSettings } from '../../../settings/settings'
import { Check, X, HelpCircle } from 'lucide-react'

type Props = {
  part: Part
  currentSpecs: SpecsBag
}

export default function PartListItem({ part, currentSpecs }: Props) {
  const { t, formatCurrency } = useI18n()
  const dispatch = useAppDispatch()
  const selected = useAppSelector((state) => state.build.selected)
  const isSelected = selected[part.category] === part.id
  const hasAnySelected = Object.values(selected).some(Boolean)
  const compat = checkCompatibility(part, currentSpecs)
  const { settings } = useSettings()
  const selectionType = settings.PART_LIST?.type ?? 'radio'

  const onSelect = () => dispatch(setPart({ category: part.category, partId: part.id }))

  return (
    <li
      className={`rounded-lg p-5 border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 shadow-sm transition hover:border-neutral-300 dark:hover:border-neutral-700 ${
        isSelected ? 'ring-2 ring-sky-500/40' : ''
      }`}
    >
      <div className="flex justify-between gap-5">
        <div className="min-w-0">
          <div className="font-medium truncate">{part.name}</div>
          <div className="text-xs text-neutral-600 dark:text-neutral-300 opacity-90 truncate">
            {part.brand} • {part.category} • {part.sku}
          </div>
        </div>
        <div className="flex items-center gap-3.5">
          {hasAnySelected ? (
            <span
              title={compat.reasons.join('\n')}
              className={`${
                compat.ok === null
                  ? 'text-neutral-500'
                  : compat.ok
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {compat.ok === null ? (
                <HelpCircle className="h-4 w-4" aria-hidden />
              ) : compat.ok ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : (
                <X className="h-4 w-4" aria-hidden />
              )}
            </span>
          ) : null}
          <div className="min-w-[96px] text-right font-medium">{formatCurrency(part.price)}</div>
          {selectionType === 'button' ? (
            <button
              onClick={onSelect}
              className="h-10 px-3 rounded-md border border-neutral-300 dark:border-neutral-700 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              {isSelected ? (typeof t === 'function' ? t('SELECTED') : 'Selected') : (typeof t === 'function' ? t('SELECT') : 'Select')}
            </button>
          ) : selectionType === 'checkbox' ? (
            <label className="inline-flex items-center gap-2 cursor-pointer select-none min-h-[40px] min-w-[40px] p-2">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => {
                  if (e.currentTarget.checked) onSelect()
                  else dispatch(removePart({ category: part.category }))
                }}
                className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 accent-sky-600 dark:accent-sky-400 focus:ring-sky-500"
              />
            </label>
          ) : (
            <label className="inline-flex items-center gap-2 cursor-pointer select-none min-h-[40px] min-w-[40px] p-2">
              <input
                type="radio"
                name={`select-${part.category}`}
                checked={isSelected}
                onChange={() => onSelect()}
                className="h-4 w-4 rounded-full border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 accent-sky-600 dark:accent-sky-400 focus:ring-sky-500"
              />
            </label>
          )}
        </div>
      </div>
    </li>
  )
}
