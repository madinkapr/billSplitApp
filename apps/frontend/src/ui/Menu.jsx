import React, { useEffect, useId, useRef, useState } from 'react'
import { Check } from 'lucide-react'

// A small dropdown: `trigger` renders the button (gets the toggle/ARIA props), `children`
// is a render function receiving `close`. Closes on outside click and Escape.
export default function Menu({ trigger, children, side = 'bottom', align = 'end', className = '', panelClassName = '' }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const position = `${side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} ${align === 'start' ? 'left-0' : 'right-0'}`

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {trigger({ onClick: () => setOpen((o) => !o), 'aria-expanded': open, 'aria-controls': id })}
      {open && (
        <div id={id} className={`absolute z-40 ${position} min-w-[12rem] rounded-ctl border border-line bg-surface text-ink shadow-lg py-1 ${panelClassName}`}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

export function MenuLabel({ children }) {
  return <p className="px-3 pt-2 pb-1 text-[13px] font-semibold text-ink-2">{children}</p>
}

// One choice in a list of options (language, currency…).
export function MenuOption({ selected, onSelect, children }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full flex items-center justify-between gap-3 px-3 min-h-[44px] text-left text-[15px] hover:bg-surface-2 ${selected ? 'font-semibold text-accent-ink' : ''}`}
    >
      <span>{children}</span>
      {selected && <Check size={16} aria-hidden="true" />}
    </button>
  )
}
