import { getItemShares } from './math'

export function getTotalUnits(item) {
  return item.quantity > 0 ? item.quantity : 1
}

export function getAssignedUnits(item) {
  return Object.values(getItemShares(item)).reduce((s, c) => s + c, 0)
}

export function getUnitPrice(item) {
  return item.price / getTotalUnits(item)
}

// A "group" item is shared by a chosen subset of people (e.g. two friends split one
// salad): `group: true` plus one share per person, and the whole price splits by those
// shares regardless of quantity. Compare `everyone: true`, which means all members.
export function isGroupItem(item) {
  return item.group === true && getAssignedUnits(item) > 0
}

export function getRemainingUnits(item) {
  if (isGroupItem(item)) return 0
  return Math.max(getTotalUnits(item) - getAssignedUnits(item), 0)
}

// 'everyone' | 'group' | 'unassigned' | 'partial' | 'done'
export function getItemState(item) {
  if (item.everyone === true && getAssignedUnits(item) === 0) return 'everyone'
  if (isGroupItem(item)) return 'group'
  const assigned = getAssignedUnits(item)
  if (assigned <= 0) return 'unassigned'
  if (assigned >= getTotalUnits(item)) return 'done'
  return 'partial'
}

export function isItemComplete(item) {
  const state = getItemState(item)
  return state === 'done' || state === 'everyone' || state === 'group'
}

// What one member pays for one item, before tip. Group items (and items handed out
// beyond their quantity in the detail sheet) split the whole price by share ratio —
// same as calculateSplits in math.js; regular items charge per unit eaten.
export function getMemberItemAmount(item, memberId) {
  const count = getItemShares(item)[memberId] || 0
  if (!count) return 0
  const assigned = getAssignedUnits(item)
  if (isGroupItem(item) || assigned > getTotalUnits(item)) return item.price * (count / assigned)
  return getUnitPrice(item) * count
}

// Applies the "who shares this?" picker: all members → everyone, one member → that
// person gets the whole item, a subset → a group item split equally among them.
export function applySplitGroup(item, selectedIds, allMemberIds) {
  const ids = allMemberIds.filter((id) => selectedIds.includes(id))
  if (ids.length === 0) return { ...item, shares: {}, everyone: false, group: false }
  if (ids.length === allMemberIds.length && ids.length > 1) {
    return { ...item, shares: {}, everyone: true, group: false }
  }
  if (ids.length === 1) {
    return { ...item, shares: { [ids[0]]: getTotalUnits(item) }, everyone: false, group: false }
  }
  return { ...item, shares: Object.fromEntries(ids.map((id) => [id, 1])), everyone: false, group: true }
}

// Who the picker should start with checked: the current group, or everyone.
export function getGroupSelection(item, allMemberIds) {
  if (isGroupItem(item)) return Object.keys(getItemShares(item)).filter((id) => allMemberIds.includes(id))
  return [...allMemberIds]
}

// Keeps a group item consistent after one person is removed from it: with a single
// person left they simply own the whole item; with nobody left it is unassigned.
export function normalizeGroupItem(item) {
  if (item.group !== true) return item
  const ids = Object.keys(getItemShares(item))
  if (ids.length === 0) return { ...item, group: false }
  if (ids.length === 1) return { ...item, shares: { [ids[0]]: getTotalUnits(item) }, group: false }
  return item
}
