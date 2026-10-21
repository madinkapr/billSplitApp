import React from 'react'

// Placeholder block shown while content loads (instead of a spinner).
export default function Skeleton({ className = '' }) {
  return <span aria-hidden="true" className={`block animate-pulse rounded-ctl bg-surface-2 ${className}`} />
}
