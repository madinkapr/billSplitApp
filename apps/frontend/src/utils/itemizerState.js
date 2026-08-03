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

export function getRemainingUnits(item) {
  return Math.max(getTotalUnits(item) - getAssignedUnits(item), 0)
}

// 'everyone' | 'unassigned' | 'partial' | 'done'
export function getItemState(item) {
  if (item.everyone === true && getAssignedUnits(item) === 0) return 'everyone'
  const assigned = getAssignedUnits(item)
  if (assigned <= 0) return 'unassigned'
  if (assigned >= getTotalUnits(item)) return 'done'
  return 'partial'
}

export function isItemComplete(item) {
  const state = getItemState(item)
  return state === 'done' || state === 'everyone'
}
