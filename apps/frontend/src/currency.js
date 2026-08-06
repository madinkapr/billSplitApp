export const CURRENCIES = {
  UZS: { code: 'UZS', symbol: "so'm", format: (n) => `${Math.round(n).toLocaleString('en-US')} so'm` },
  RUB: { code: 'RUB', symbol: '₽', format: (n) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(n) },
  USD: { code: 'USD', symbol: '$', format: (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n) },
}

function getInitialCurrency() {
  try {
    const stored = JSON.parse(localStorage.getItem('tabup_currency'))
    if (stored in CURRENCIES) return stored
  } catch {
    // storage unavailable or malformed — fall through to default
  }
  return 'UZS'
}

let currency = getInitialCurrency()
const listeners = new Set()

export function getCurrency() {
  return currency
}

export function setCurrency(code) {
  if (!(code in CURRENCIES) || code === currency) return
  currency = code
  try {
    localStorage.setItem('tabup_currency', JSON.stringify(code))
  } catch {
    // storage full or unavailable
  }
  listeners.forEach((l) => l())
}

export function subscribeCurrency(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function fmt(amount) {
  return CURRENCIES[currency].format(amount)
}
