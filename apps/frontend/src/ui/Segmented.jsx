import React, { useRef } from 'react'

// Radio-group of equal buttons (e.g. service charge 0/10/12/15/Other). Arrow keys move
// the choice, like native radios.
export default function Segmented({ options, value, onChange, labelledBy, className = '' }) {
  const refs = useRef([])

  function onKeyDown(e, i) {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = (i + step + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }

  const selectedIndex = options.findIndex((o) => o.value === value)

  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className={`grid gap-1.5 ${className}`} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o, i) => {
        const checked = o.value === value
        return (
          <button
            key={String(o.value)}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked || (selectedIndex === -1 && i === 0) ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`min-h-[48px] min-w-0 px-1 rounded-ctl text-[15px] truncate ${
              checked ? 'border-2 border-accent bg-accent-tint text-accent-ink font-bold' : 'border border-line-strong bg-surface font-semibold hover:bg-surface-2'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
