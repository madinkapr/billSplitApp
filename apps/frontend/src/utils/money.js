// Money as people read it: digits grouped by spaces ("1 232 000"). Inputs keep a clean
// numeric string ("1232000", "12.5") as their value and only format what is shown.

const NBSP = ' '

export function groupDigits(intPart) {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)
}

// Clean numeric string → display string. Whole-number currencies (so'm) never show ".00".
export function formatAmountInput(value, decimals) {
  if (value === '' || value == null) return ''
  let str = String(value)
  if (decimals === 0) {
    const n = parseFloat(str)
    if (Number.isFinite(n) && Number.isInteger(n)) str = String(n)
  }
  const [int, frac] = str.split('.')
  const grouped = groupDigits(int.replace(/^0+(?=\d)/, ''))
  return frac !== undefined ? `${grouped}.${frac}` : grouped
}

// What the user typed → clean numeric string (spaces dropped, comma read as a decimal
// point, at most `decimals` fraction digits).
export function parseAmountInput(raw, decimals) {
  let s = String(raw).replace(/[\s  ]/g, '').replace(',', '.')
  s = s.replace(/[^\d.]/g, '')
  const dot = s.indexOf('.')
  if (dot === -1 || decimals === 0) return dot === -1 ? s : s.slice(0, dot)
  return s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '').slice(0, decimals)
}

// A number from OCR/voice as an input value, without float noise or "1232000.00".
export function amountToInput(n) {
  if (n == null || n === '' || !Number.isFinite(Number(n))) return ''
  return String(Math.round(Number(n) * 100) / 100)
}
