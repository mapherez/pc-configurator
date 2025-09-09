import { useI18n } from '../../../i18n/i18n'
import RangeSlider from './RangeSlider'

type Props = {
  brand: string
  setBrand: (v: string) => void
  brands: string[]

  query: string
  setQuery: (v: string) => void

  priceMin: number | null
  setPriceMin: (v: number | null) => void

  priceMax: number | null
  setPriceMax: (v: number | null) => void

  sliderBounds: { min: number; max: number }
  sliderMaxDynamic: number
}

export default function FilterBar(props: Props) {
  const { t } = useI18n()
  const { brand, setBrand, brands, query, setQuery, priceMin, setPriceMin, priceMax, setPriceMax, sliderBounds, sliderMaxDynamic } = props

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 p-4 shadow-sm">
      <label className="flex flex-col gap-1 sm:col-span-1">
        <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">{t('BRAND')}</span>
        <select
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className="h-10 min-w-[160px] px-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          <option value="">{t('BRAND_ALL')}</option>
          {brands.map((b) => (
            <option value={b} key={b}>
              {b}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 sm:col-span-1">
        <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">{t('SEARCH')}</span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('SEARCH_PLACEHOLDER')}
          className="h-10 min-w-[220px] px-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        />
      </label>

      <div className="col-span-1 sm:col-span-2">
        <RangeSlider
          min={priceMin}
          max={priceMax}
          onChangeMin={setPriceMin}
          onChangeMax={setPriceMax}
          boundMin={sliderBounds.min}
          boundMax={sliderMaxDynamic}
          format={(n) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(n)}
        />
      </div>
    </div>
  )
}
