import React from 'react'

// White panel. `flush` drops the padding for edge-to-edge lists.
export default function Card({ as: Tag = 'section', flush = false, className = '', children, ...rest }) {
  const pad = flush ? 'overflow-hidden' : 'p-4 sm:p-5 flex flex-col gap-4'
  return (
    <Tag className={`bg-surface border border-line rounded-card min-w-0 ${pad} ${className}`} {...rest}>
      {children}
    </Tag>
  )
}

// A bordered list whose rows are separated by hairlines.
export function List({ as: Tag = 'div', className = '', children, ...rest }) {
  return (
    <Tag className={`bg-surface border border-line rounded-card overflow-hidden divide-y divide-line ${className}`} {...rest}>
      {children}
    </Tag>
  )
}

// Section title with an optional link/button on the right.
export function SectionHead({ id, title, action, as: H = 'h2' }) {
  return (
    <div className="flex items-center justify-between gap-3 min-h-[44px]">
      <H id={id} className="text-[18px] font-semibold tracking-[-0.01em]">{title}</H>
      {action}
    </div>
  )
}
