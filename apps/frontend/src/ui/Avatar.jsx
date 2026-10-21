import React from 'react'

const TONES = ['a1', 'a2', 'a3', 'a4', 'a5']

const TONE_CLASS = {
  a1: 'bg-a1 text-a1-fg',
  a2: 'bg-a2 text-a2-fg',
  a3: 'bg-a3 text-a3-fg',
  a4: 'bg-a4 text-a4-fg',
  a5: 'bg-a5 text-a5-fg',
  off: 'bg-surface-2 text-ink-2',
  solid: 'bg-accent text-on-accent',
}

const SIZE_CLASS = {
  xs: 'w-[26px] h-[26px] text-[11px] ring-2 ring-surface',
  sm: 'w-7 h-7 text-[12px]',
  md: 'w-9 h-9 text-[14px]',
  lg: 'w-10 h-10 text-[16px]',
}

// Same id → same colour everywhere (setup, assign, split), so people are easy to follow.
export function toneFor(id) {
  let h = 0
  for (const ch of String(id ?? '')) h = (h * 31 + ch.charCodeAt(0)) | 0
  return TONES[Math.abs(h) % TONES.length]
}

export function initialOf(name) {
  return (name || '?').trim().charAt(0).toUpperCase() || '?'
}

// Initials in one of five colours. `children` replaces the initial (e.g. a crew emoji),
// `src` shows a photo, `tone` forces a colour ('off', 'solid', or a1–a5).
export default function Avatar({ name, id, size = 'md', square = false, tone, src, children, className = '' }) {
  const shape = square ? 'rounded-ctl' : 'rounded-full'
  const base = `inline-flex flex-none items-center justify-center font-bold select-none ${SIZE_CLASS[size]} ${shape} ${className}`
  if (src) {
    return <img src={src} alt="" referrerPolicy="no-referrer" className={`${base} object-cover`} />
  }
  return (
    <span aria-hidden="true" className={`${base} ${TONE_CLASS[tone || toneFor(id ?? name)]}`}>
      {children ?? initialOf(name)}
    </span>
  )
}

// Overlapping avatars for "who shares this dish".
export function AvatarStack({ people, max = 4 }) {
  const shown = people.slice(0, max)
  const extra = people.length - shown.length
  return (
    <span className="inline-flex flex-none">
      {shown.map((p, i) => (
        <Avatar key={p.id} id={p.id} name={p.name} size="xs" className={i > 0 ? '-ml-2' : ''} />
      ))}
      {extra > 0 && <Avatar size="xs" tone="off" className="-ml-2">+{extra}</Avatar>}
    </span>
  )
}
