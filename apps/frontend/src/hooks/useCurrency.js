import { useSyncExternalStore } from 'react'
import { getCurrency, setCurrency, subscribeCurrency, fmt, roundForCurrency, CURRENCIES } from '../currency'

export function useCurrency() {
  const currency = useSyncExternalStore(subscribeCurrency, getCurrency)
  return { currency, setCurrency, fmt, roundForCurrency, symbol: CURRENCIES[currency].symbol, CURRENCIES }
}
