import { useSyncExternalStore } from 'react'
import { getCurrency, setCurrency, subscribeCurrency, fmt, CURRENCIES } from '../currency'

export function useCurrency() {
  const currency = useSyncExternalStore(subscribeCurrency, getCurrency)
  return { currency, setCurrency, fmt, symbol: CURRENCIES[currency].symbol, CURRENCIES }
}
