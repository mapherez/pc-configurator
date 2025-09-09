import { useState, useId } from 'react'
import { ChevronDown } from 'lucide-react'

type Props = {
  title: string
  countLabel?: string
  defaultOpen?: boolean
  children: React.ReactNode
}

export default function AccordionItem({ title, countLabel, defaultOpen, children }: Props) {
  const [open, setOpen] = useState<boolean>(!!defaultOpen)
  const regionId = useId()

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 shadow-sm">
      <button
        type="button"
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded-t-xl"
        aria-expanded={open}
        aria-controls={regionId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="font-semibold tracking-tight capitalize">{title}</span>
        <span className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
          {countLabel ? <span className="opacity-80">{countLabel}</span> : null}
          <ChevronDown aria-hidden className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : 'rotate-0'}`} />
        </span>
      </button>
      <div id={regionId} role="region" hidden={!open} className="p-4">
        {children}
      </div>
    </div>
  )
}
