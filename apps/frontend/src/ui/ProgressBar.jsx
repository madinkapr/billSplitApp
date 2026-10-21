import React from 'react'

const FILL = { accent: 'bg-accent', ok: 'bg-ok-fill', warn: 'bg-warn' }

export default function ProgressBar({ value, tone = 'accent', label }) {
  const pct = Math.max(0, Math.min(100, Math.round(value || 0)))
  return (
    <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label} className="h-2 rounded bg-surface-2 overflow-hidden">
      <span className={`block h-full rounded transition-[width] duration-300 ease-out ${FILL[tone]}`} style={{ width: `${pct}%` }} />
    </div>
  )
}
