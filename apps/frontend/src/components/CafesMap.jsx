import React from 'react'
import { useTranslation } from 'react-i18next'

// The cafe map, shown as is: a self-contained page from the private `map` repo that the
// backend serves (routes/kafelar.js). `allow="geolocation"` lets its "near me" button ask
// for the location from inside the frame. `?lang=` shows the map in the app's language; a
// language switch changes the src, so the frame reloads in the new one.
export default function CafesMap({ className = '' }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage || i18n.language
  return <iframe src={`/api/kafelar/map?lang=${encodeURIComponent(lang)}`} title={t('nav.cafes')} allow="geolocation" className={`w-full border-0 ${className}`} />
}
