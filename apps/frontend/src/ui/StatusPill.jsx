import React from 'react'

const TONE = {
  neutral: 'bg-surface-2 text-muted-pill',
  ok: 'bg-ok-tint text-ok',
  warn: 'bg-warn-tint text-warn',
  accent: 'bg-accent-tint text-accent-ink',
}

export default function StatusPill({ tone = 'neutral', className = '', children }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] font-semibold whitespace-nowrap ${TONE[tone]} ${className}`}>
      {children}
    </span>
  )
}
