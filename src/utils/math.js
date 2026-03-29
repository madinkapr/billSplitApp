/**
 * Proportional split: tip/tax are distributed based on each person's food share.
 *
 * Steps:
 * 1. For each item, divide price by number of assignees → add share to each person's subtotal
 * 2. Sum all subtotals → totalSubtotal
 * 3. ratio = grandTotal / totalSubtotal
 * 4. finalTotal = personalSubtotal * ratio  (rounded to 2 dp)
 * 5. Add any rounding remainder to the first person so totals always sum exactly to grandTotal
 */
export function calculateSplits({ items, members, grandTotal }) {
  // Step 1 — personal food subtotals
  const subtotals = {}
  members.forEach((m) => { subtotals[m.id] = 0 })

  items.forEach((item) => {
    const assignees = item.assignees.filter((id) => members.some((m) => m.id === id))
    // Unassigned items fall back to splitting among everyone
    const split = assignees.length > 0 ? assignees : members.map((m) => m.id)
    const share = item.price / split.length
    split.forEach((id) => { subtotals[id] += share })
  })

  // Step 2 — total of all subtotals
  const totalSubtotal = Object.values(subtotals).reduce((s, v) => s + v, 0)

  if (totalSubtotal === 0) {
    return members.map((m) => ({ ...m, subtotal: 0, finalTotal: 0 }))
  }

  // Step 3 — ratio
  const ratio = grandTotal / totalSubtotal

  // Step 4 — multiply and round
  const finals = {}
  members.forEach((m) => {
    finals[m.id] = Math.round(subtotals[m.id] * ratio * 100) / 100
  })

  // Step 5 — rounding correction: work in integer cents to avoid float issues
  const grandCents = Math.round(grandTotal * 100)
  const sumCents = Object.values(finals).reduce((s, v) => s + Math.round(v * 100), 0)
  const diffCents = grandCents - sumCents
  if (diffCents !== 0) {
    finals[members[0].id] = Math.round((finals[members[0].id] * 100 + diffCents)) / 100
  }

  return members.map((m) => ({
    ...m,
    subtotal: Math.round(subtotals[m.id] * 100) / 100,
    finalTotal: finals[m.id],
  }))
}

export function fmt(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export function generateId() {
  return Math.random().toString(36).slice(2, 10)
}
