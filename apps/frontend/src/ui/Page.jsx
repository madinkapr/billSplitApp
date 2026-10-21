import React from 'react'
import { ArrowLeft } from 'lucide-react'
import Button from './Button'

// The content column: 1120px max, mobile-first padding. `topInset` adds the notch inset on
// screens without the top bar; `tight` is the denser gap used by the bill flow.
export default function Page({ topInset = true, tight = false, className = '', children }) {
  const top = topInset ? 'pt-[calc(8px+env(safe-area-inset-top))] sm:pt-[calc(16px+env(safe-area-inset-top))]' : 'pt-2 sm:pt-4'
  const gap = tight ? 'gap-4 lg:gap-6' : 'gap-6 lg:gap-8'
  return (
    <div className={`w-full max-w-[1120px] mx-auto flex-1 flex flex-col px-4 pb-8 sm:px-6 sm:pb-10 lg:px-12 lg:pt-10 lg:pb-14 ${top} ${gap} ${className}`}>
      {children}
    </div>
  )
}

// Back button, title and a short line under it, actions on the right.
export function PageHeader({ title, meta, onBack, backLabel, actions }) {
  return (
    <div className="flex items-center gap-2">
      {onBack && (
        <Button icon variant="secondary" onClick={onBack} aria-label={backLabel} className="!border-transparent !bg-transparent hover:!bg-surface-2 -ml-2">
          <ArrowLeft size={22} strokeWidth={1.8} aria-hidden="true" />
        </Button>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-[18px] font-semibold lg:text-[28px] lg:font-bold lg:tracking-[-0.02em] leading-tight truncate">{title}</h1>
        {meta && <p className="text-[14px] text-ink-2 truncate">{meta}</p>}
      </div>
      {actions}
    </div>
  )
}

// Bottom action bar: pinned to the screen bottom on phones/tablets (bleeding to the edges
// of Page's padding), an ordinary inline row on desktop. Keep it the last child of Page.
export function ActionBar({ className = '', children }) {
  return (
    <div
      className={`sticky bottom-0 z-20 mt-auto -mx-4 -mb-8 sm:-mx-6 sm:-mb-10 flex items-center gap-3 bg-surface border-t border-line px-4 sm:px-6 pt-3 pb-[calc(14px+env(safe-area-inset-bottom))] lg:static lg:m-0 lg:bg-transparent lg:border-0 lg:p-0 ${className}`}
    >
      {children}
    </div>
  )
}

// The small label + big figure on the left of an action bar.
export function ActionSum({ label, value }) {
  return (
    <span className="flex flex-col min-w-0">
      <small className="text-[13px] text-ink-2 truncate">{label}</small>
      <b className="num text-[18px] font-bold">{value}</b>
    </span>
  )
}
