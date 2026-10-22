import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

// App-side tweaks to the map page, added from here so the `map` repo stays as is:
// - no in-map "Walk" / "Drive" route buttons (nor the "set your location first" hint that
//   goes with them); the place card keeps its Yandex / Google Maps links.
// - a dark look while the frame's <html> has data-theme="dark": the page's colour tokens get
//   the app's dark palette and the OSM tiles are darkened with a filter (OSM has no dark tiles).
const MAP_CSS = `
.card .go-row:has([data-route]), .card .go .hint { display: none }
html[data-theme=dark] {
  --bg: #0E1116; --card: #161A21; --fg: #EEF1F5; --muted: #A4ADBC; --line: #2A303B;
  --chip: #1F242D; --chip-on: #EEF1F5; --pin-soft: #A8504D; --me: #2B74D6;
  color-scheme: dark;
}
html[data-theme=dark] .chip[aria-pressed=true],
html[data-theme=dark] .chip[aria-pressed=true] svg { color: #0E1116 }
html[data-theme=dark] .leaflet-tile-pane { filter: invert(1) hue-rotate(180deg) brightness(.95) contrast(.85) saturate(.5) }
html[data-theme=dark] .pin .lbl { text-shadow: 0 0 2px #0E1116, 0 0 2px #0E1116, 0 0 3px #0E1116, 0 0 4px #0E1116 }
html[data-theme=dark] .me-dot { border-color: #EEF1F5 }
html[data-theme=dark] .grip::before { background: #3B4250 }
html[data-theme=dark] .leaflet-popup-content-wrapper,
html[data-theme=dark] .leaflet-popup-tip { background: var(--card); color: var(--fg) }
html[data-theme=dark] .leaflet-container a.leaflet-popup-close-button { color: var(--muted) }
html[data-theme=dark] .leaflet-bar a { background: var(--card); color: var(--fg); border-bottom-color: var(--line) }
html[data-theme=dark] .leaflet-bar a.leaflet-disabled { background: var(--chip); color: var(--muted) }
html[data-theme=dark] .leaflet-control-attribution { background: rgb(22 26 33 / .85); color: var(--muted) }
html[data-theme=dark] .leaflet-control-attribution a { color: #8DB9F2 }
`

const appTheme = () => document.documentElement.dataset.theme || 'light'

// Adds MAP_CSS and puts the app's current theme on the map page. The frame is same-origin (/api/kafelar/map),
// so its document is reachable; if it ever isn't, the map just shows as built.
function applyTheme(frame) {
  let doc
  try {
    doc = frame?.contentDocument
  } catch {
    return true
  }
  if (!doc?.head || doc.URL === 'about:blank') return false
  if (!doc.getElementById('app-map-style')) {
    const style = doc.createElement('style')
    style.id = 'app-map-style'
    style.textContent = MAP_CSS
    doc.head.appendChild(style)
  }
  doc.documentElement.dataset.theme = appTheme()
  return true
}

// The cafe map, shown as is: a self-contained page from the private `map` repo that the
// backend serves (routes/kafelar.js). `allow="geolocation"` lets its "near me" button ask
// for the location from inside the frame. `?lang=` shows the map in the app's language; a
// language switch changes the src, so the frame reloads in the new one. The light/dark
// theme follows the app without a reload.
export default function CafesMap({ className = '' }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage || i18n.language
  const frameRef = useRef(null)
  const src = `/api/kafelar/map?lang=${encodeURIComponent(lang)}`

  // Style the page as soon as it's parsed: the load event waits for every map tile, which
  // would leave a dark-mode user looking at a white map for a while.
  // Gives up after 15s; onLoad below still catches a slow page.
  useEffect(() => {
    const started = Date.now()
    const timer = setInterval(() => {
      const doc = frameRef.current?.contentDocument
      const done = doc && doc.readyState !== 'loading' && applyTheme(frameRef.current)
      if (done || Date.now() - started > 15000) clearInterval(timer)
    }, 50)
    return () => clearInterval(timer)
  }, [src])

  // <html data-theme> changes on the in-app switch and, in "Auto", when the device does.
  useEffect(() => {
    const observer = new MutationObserver(() => applyTheme(frameRef.current))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  return (
    <iframe
      ref={frameRef}
      src={src}
      title={t('nav.cafes')}
      allow="geolocation"
      onLoad={(e) => applyTheme(e.currentTarget)}
      className={`w-full border-0 bg-bg ${className}`}
    />
  )
}
