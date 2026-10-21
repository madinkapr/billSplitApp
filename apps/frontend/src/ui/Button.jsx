import React from 'react'

const VARIANT = {
  primary: 'bg-accent border-accent text-on-accent hover:bg-accent-ink hover:border-accent-ink',
  secondary: 'bg-surface border-line text-ink hover:bg-surface-2',
  tint: 'bg-accent-tint border-transparent text-accent-ink hover:border-accent-line',
  quiet: 'bg-transparent border-transparent text-link !px-1 hover:underline underline-offset-[3px]',
}

const SIZE = {
  sm: 'min-h-[44px] px-3.5 text-[15px] rounded-ctl',
  md: 'min-h-[48px] px-5 text-[16px] rounded-ctl',
  lg: 'min-h-[54px] px-5 text-[16px] rounded-[14px]',
}

// `icon` makes a round 44px icon-only button (give it an aria-label).
export default function Button({ as: Tag = 'button', variant = 'secondary', size = 'md', icon = false, block = false, className = '', children, ...rest }) {
  const shape = icon ? 'w-11 h-11 min-h-[44px] p-0 rounded-full flex-none' : SIZE[size]
  const cls = [
    'inline-flex items-center justify-center gap-2 border font-semibold select-none',
    'transition-[background-color,transform] duration-100 ease-out active:enabled:scale-[0.97]',
    'disabled:bg-surface-2 disabled:border-surface-2 disabled:text-ink-2 disabled:cursor-not-allowed disabled:no-underline',
    VARIANT[variant],
    shape,
    block ? 'w-full' : '',
    className,
  ].join(' ')
  return (
    <Tag {...(Tag === 'button' ? { type: 'button' } : {})} className={cls} {...rest}>
      {children}
    </Tag>
  )
}
