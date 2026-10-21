import React from 'react'

export default function Logo({ className = '' }) {
  return (
    <span className={`text-[22px] font-bold tracking-[-0.02em] text-ink ${className}`}>
      schet<span className="text-link">.uz</span>
    </span>
  )
}
