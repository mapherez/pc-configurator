import { useMemo, useRef, useState, useEffect, useCallback } from 'react'

type Props = {
  min: number | null
  max: number | null
  onChangeMin: (v: number | null) => void
  onChangeMax: (v: number | null) => void
  boundMin?: number
  boundMax: number
  format?: (n: number) => string
}

export default function RangeSlider({ min, max, onChangeMin, onChangeMax, boundMin = 0, boundMax, format }: Props) {
  const lo = min ?? boundMin
  const hi = max ?? boundMax

  const trackRef = useRef<HTMLDivElement | null>(null)
  const [dragging, setDragging] = useState<null | 'lo' | 'hi'>(null)

  const pct = useCallback((v: number) => ((v - boundMin) / Math.max(1, boundMax - boundMin)) * 100, [boundMin, boundMax])
  const loPct = useMemo(() => pct(lo), [lo, pct])
  const hiPct = useMemo(() => pct(hi), [hi, pct])

  const display = (n: number) => (format ? format(n) : String(n))

  const clamp = (value: number, minVal: number, maxVal: number) => Math.min(Math.max(value, minVal), maxVal)
  const valueFromClientX = useCallback((clientX: number) => {
    const el = trackRef.current
    if (!el) return boundMin
    const rect = el.getBoundingClientRect()
    const ratio = clamp((clientX - rect.left) / Math.max(1, rect.width), 0, 1)
    const raw = boundMin + ratio * (boundMax - boundMin)
    // round to cents
    return Math.round(raw * 100) / 100
  }, [boundMin, boundMax])

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: PointerEvent) => {
      const val = valueFromClientX(e.clientX)
      if (dragging === 'lo') {
        const newLo = clamp(val, boundMin, max ?? boundMax)
        onChangeMin(newLo <= boundMin ? null : newLo)
      } else if (dragging === 'hi') {
        const newHi = clamp(val, min ?? boundMin, boundMax)
        onChangeMax(newHi >= boundMax ? null : newHi)
      }
    }
    const onUp = () => setDragging(null)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp, { once: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [dragging, valueFromClientX, onChangeMin, onChangeMax, boundMin, boundMax, min, max])

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-300 mb-1">
        <span>
          <span className="opacity-80 mr-1">Min</span>
          <span className="font-medium">{display(lo)}</span>
        </span>
        <span>
          <span className="opacity-80 mr-1">Max</span>
          <span className="font-medium">{display(hi)}</span>
        </span>
      </div>
      <div className="relative h-8" ref={trackRef}>
        {/* Track */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-neutral-200 dark:bg-neutral-800" />
        {/* Selected range */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500"
          style={{ left: `${loPct}%`, right: `${100 - hiPct}%` }}
        />
        {/* Low thumb - clickable only on the dot */}
        <button
          type="button"
          aria-label="Minimum price"
          className="absolute -translate-x-1/2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-white dark:bg-neutral-200 ring-1 ring-black/10 dark:ring-white/20 shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          style={{ left: `${loPct}%` }}
          onPointerDown={(e) => {
            e.preventDefault()
            ;(e.target as Element).setPointerCapture?.(e.pointerId)
            setDragging('lo')
          }}
        />
        {/* High thumb - clickable only on the dot */}
        <button
          type="button"
          aria-label="Maximum price"
          className="absolute -translate-x-1/2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-white dark:bg-neutral-200 ring-1 ring-black/10 dark:ring-white/20 shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          style={{ left: `${hiPct}%` }}
          onPointerDown={(e) => {
            e.preventDefault()
            ;(e.target as Element).setPointerCapture?.(e.pointerId)
            setDragging('hi')
          }}
        />
      </div>
    </div>
  )
}
