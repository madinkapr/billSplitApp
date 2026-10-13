import React from 'react'
import { useTranslation } from 'react-i18next'

// The cafe map, shown as is: a self-contained page from the private `map` repo that the
// backend serves (routes/kafelar.js). `allow="geolocation"` lets its "near me" button ask
// for the location from inside the frame.
export default function CafesMap({ className = '' }) {
  const { t } = useTranslation()
  return <iframe src="/api/kafelar/map" title={t('nav.cafes')} allow="geolocation" className={`w-full border-0 ${className}`} />
}
