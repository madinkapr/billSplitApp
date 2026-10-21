// Colour theme: 'light', 'dark' or 'system' (follow the device). The resolved theme is put on
// <html data-theme="…">, which switches the CSS tokens in index.css. index.html runs the same
// resolution inline before the first paint, so a dark page never flashes white.
const STORAGE_KEY = 'tabup_theme'
export const THEMES = ['light', 'dark', 'system']

const media = window.matchMedia('(prefers-color-scheme: dark)')

function readPref() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (THEMES.includes(stored)) return stored
  } catch {
    // storage unavailable or malformed — fall through to default
  }
  return 'system'
}

let pref = readPref()
const listeners = new Set()

function apply() {
  const dark = pref === 'dark' || (pref === 'system' && media.matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}

export function getThemePref() {
  return pref
}

export function setThemePref(next) {
  if (!THEMES.includes(next) || next === pref) return
  pref = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // storage full or unavailable
  }
  apply()
  listeners.forEach((l) => l())
}

export function subscribeTheme(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

// "Auto" follows the device switching between light and dark (e.g. at sunset).
media.addEventListener('change', () => pref === 'system' && apply())
apply()
