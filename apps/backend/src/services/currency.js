const CURRENCIES = {
  UZS: { code: 'UZS', symbol: "so'm", format: (n) => `${Math.round(n).toLocaleString('en-US')} so'm` },
  RUB: { code: 'RUB', symbol: '₽', format: (n) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(n) },
  USD: { code: 'USD', symbol: '$', format: (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n) },
}

const DEFAULT_CURRENCY = 'UZS'

function isValidCurrency(code) {
  return code in CURRENCIES
}

function formatAmount(amount, code) {
  const currency = CURRENCIES[code] || CURRENCIES[DEFAULT_CURRENCY]
  return currency.format(amount)
}

module.exports = { CURRENCIES, DEFAULT_CURRENCY, isValidCurrency, formatAmount }
