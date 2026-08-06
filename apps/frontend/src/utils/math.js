/**
 * Normalize an item's per-member share counts into a `shares` map.
 *
 * Supports both the new model (`item.shares = { memberId: count }`) and the legacy
 * model (`item.assignees = [memberId, ...]`, which maps to count 1 each). Older saved
 * bills predate `shares`, so this shim lets them load and calculate unchanged.
 */
export function getItemShares(item) {
  if (item.shares && typeof item.shares === 'object') {
    // Keep only positive counts
    const out = {}
    Object.entries(item.shares).forEach(([id, count]) => {
      if (count > 0) out[id] = count
    })
    return out
  }
  if (Array.isArray(item.assignees)) {
    const out = {}
    item.assignees.forEach((id) => { out[id] = 1 })
    return out
  }
  return {}
}

/**
 * Proportional split: tip/tax are distributed based on each person's food share.
 *
 * Steps:
 * 1. For each item, split price by each assignee's share count → add to their subtotal
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
    // Keep only counts belonging to active members
    const shares = {}
    Object.entries(getItemShares(item)).forEach(([id, count]) => {
      if (members.some((m) => m.id === id)) shares[id] = count
    })
    const ids = Object.keys(shares)
    if (ids.length > 0) {
      const totalCount = ids.reduce((s, id) => s + shares[id], 0)
      ids.forEach((id) => { subtotals[id] += item.price * (shares[id] / totalCount) })
    } else {
      // Unassigned items fall back to splitting among everyone
      const share = item.price / members.length
      members.forEach((m) => { subtotals[m.id] += share })
    }
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

export function generateId() {
  return Math.random().toString(36).slice(2, 10)
}
