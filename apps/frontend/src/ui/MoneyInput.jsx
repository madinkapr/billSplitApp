import React, { forwardRef, useLayoutEffect, useRef } from 'react'
import { useCurrency } from '../hooks/useCurrency'
import { formatAmountInput, parseAmountInput } from '../utils/money'

// Count of digits/decimal points before `pos` — survives re-grouping with spaces.
function significantBefore(str, pos) {
  return str.slice(0, pos).replace(/[^\d.]/g, '').length
}

function positionAfter(str, count) {
  if (count === 0) return 0
  let seen = 0
  for (let i = 0; i < str.length; i++) {
    if (/[\d.]/.test(str[i])) seen++
    if (seen === count) return i + 1
  }
  return str.length
}

// Amount field that groups digits while typing ("1 232 000") but reports a clean numeric
// string through onChange. `size="lg"` is the big underlined total on the setup screen.
const MoneyInput = forwardRef(function MoneyInput({ value, onChange, size = 'md', className = '', invalid = false, ...rest }, forwardedRef) {
  const { CURRENCIES, currency } = useCurrency()
  const { decimals, symbol } = CURRENCIES[currency]
  const innerRef = useRef(null)
  const caretRef = useRef(null)
  const display = formatAmountInput(value, decimals)

  useLayoutEffect(() => {
    if (caretRef.current == null || document.activeElement !== innerRef.current) return
    const pos = positionAfter(display, caretRef.current)
    innerRef.current.setSelectionRange(pos, pos)
    caretRef.current = null
  }, [display])

  function handleChange(e) {
    caretRef.current = significantBefore(e.target.value, e.target.selectionStart ?? e.target.value.length)
    onChange(parseAmountInput(e.target.value, decimals))
  }

  function setRef(el) {
    innerRef.current = el
    if (typeof forwardedRef === 'function') forwardedRef(el)
    else if (forwardedRef) forwardedRef.current = el
  }

  const input = (
    <input
      ref={setRef}
      type="text"
      inputMode={decimals > 0 ? 'decimal' : 'numeric'}
      autoComplete="off"
      value={display}
      onChange={handleChange}
      placeholder="0"
      aria-invalid={invalid || undefined}
      {...rest}
      className={
        size === 'lg'
          ? 'num flex-1 min-w-0 bg-transparent p-0 border-0 outline-none text-[clamp(32px,3vw+20px,44px)] font-bold tracking-[-0.025em] text-ink placeholder:text-ink-2/60'
          : 'num flex-1 min-w-0 bg-transparent px-0 py-0 border-0 outline-none text-[16px] text-ink placeholder:text-ink-2'
      }
    />
  )

  if (size === 'lg') {
    return (
      <div className={`flex items-baseline gap-2 border-b-2 pb-1.5 ${invalid ? 'border-warn' : 'border-accent'} ${className}`}>
        {input}
        <span aria-hidden="true" className="text-[18px] font-semibold text-ink-2">{symbol}</span>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2 min-h-[48px] px-3.5 rounded-ctl border bg-surface focus-within:outline focus-within:outline-2 focus-within:outline-accent focus-within:border-transparent ${invalid ? 'border-warn' : 'border-line-strong'} ${className}`}>
      {input}
      <span aria-hidden="true" className="text-[15px] font-medium text-ink-2">{symbol}</span>
    </div>
  )
})

export default MoneyInput
