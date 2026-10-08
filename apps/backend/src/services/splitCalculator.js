/**
 * Normalize an item's per-member share counts into a `shares` map.
 *
 * Supports both the new model (`item.shares = { memberId: count }`) and the legacy
 * model (`item.assignees = [memberId, ...]`, which maps to count 1 each). Older saved
 * bills predate `shares`, so this shim lets them load and calculate unchanged.
 */
function getItemShares(item) {
  if (item.shares && typeof item.shares === 'object') {
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
function calculateSplits({ items, members, grandTotal }) {
  const subtotals = {}
  members.forEach((m) => { subtotals[m.id] = 0 })

  items.forEach((item) => {
    const shares = {}
    Object.entries(getItemShares(item)).forEach(([id, count]) => {
      if (members.some((m) => m.id === id)) shares[id] = count
    })
    const ids = Object.keys(shares)
    if (ids.length > 0) {
      const totalCount = ids.reduce((s, id) => s + shares[id], 0)
      ids.forEach((id) => { subtotals[id] += item.price * (shares[id] / totalCount) })
    } else {
      const share = item.price / members.length
      members.forEach((m) => { subtotals[m.id] += share })
    }
  })

  const totalSubtotal = Object.values(subtotals).reduce((s, v) => s + v, 0)

  if (totalSubtotal === 0) {
    return members.map((m) => ({ ...m, subtotal: 0, finalTotal: 0 }))
  }

  const ratio = grandTotal / totalSubtotal

  const finals = {}
  members.forEach((m) => {
    finals[m.id] = Math.round(subtotals[m.id] * ratio * 100) / 100
  })

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

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

function getTotalUnits(item) {
  return item.quantity > 0 ? item.quantity : 1
}

function getAssignedUnits(item) {
  return Object.values(getItemShares(item)).reduce((s, c) => s + c, 0)
}

function getUnitPrice(item) {
  return item.price / getTotalUnits(item)
}

// A "group" item is shared by a chosen subset of people (e.g. two friends split one
// salad): `group: true` plus one share per person, and the whole price splits by those
// shares regardless of quantity. Mirrors the frontend's utils/itemizerState.js.
function isGroupItem(item) {
  return item.group === true && getAssignedUnits(item) > 0
}

function getRemainingUnits(item) {
  if (isGroupItem(item)) return 0
  return Math.max(getTotalUnits(item) - getAssignedUnits(item), 0)
}

// 'everyone' | 'group' | 'unassigned' | 'partial' | 'done'
function getItemState(item) {
  if (item.everyone === true && getAssignedUnits(item) === 0) return 'everyone'
  if (isGroupItem(item)) return 'group'
  const assigned = getAssignedUnits(item)
  if (assigned <= 0) return 'unassigned'
  if (assigned >= getTotalUnits(item)) return 'done'
  return 'partial'
}

function isItemComplete(item) {
  const state = getItemState(item)
  return state === 'done' || state === 'everyone' || state === 'group'
}

// What one member pays for one item, before tip — group items split the whole price
// by share ratio (same as calculateSplits), regular items charge per unit eaten.
function getMemberItemAmount(item, memberId) {
  const count = getItemShares(item)[memberId] || 0
  if (!count) return 0
  const assigned = getAssignedUnits(item)
  if (isGroupItem(item) || assigned > getTotalUnits(item)) return item.price * (count / assigned)
  return getUnitPrice(item) * count
}

// Applies a "who shares this?" selection: all members → everyone, one member → that
// person gets the whole item, a subset → a group item split equally among them.
function applySplitGroup(item, selectedIds, allMemberIds) {
  const ids = allMemberIds.filter((id) => selectedIds.includes(id))
  if (ids.length === 0) return { ...item, shares: {}, everyone: false, group: false }
  if (ids.length === allMemberIds.length && ids.length > 1) return { ...item, shares: {}, everyone: true, group: false }
  if (ids.length === 1) return { ...item, shares: { [ids[0]]: getTotalUnits(item) }, everyone: false, group: false }
  return { ...item, shares: Object.fromEntries(ids.map((id) => [id, 1])), everyone: false, group: true }
}

module.exports = {
  getItemShares,
  calculateSplits,
  generateId,
  getTotalUnits,
  getAssignedUnits,
  getUnitPrice,
  getRemainingUnits,
  getItemState,
  isItemComplete,
  isGroupItem,
  getMemberItemAmount,
  applySplitGroup,
}
