import { getCurrency } from '../currency'

const VISITOR_ID_KEY = 'tabup_visitor_id'

function getVisitorId() {
  try {
    let id = localStorage.getItem(VISITOR_ID_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(VISITOR_ID_KEY, id)
    }
    return id
  } catch {
    return null
  }
}

export function trackPageView() {
  const visitorId = getVisitorId()
  if (!visitorId) return

  fetch('/api/analytics/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitorId }),
  }).catch(() => {
    // analytics failures should never affect the app
  })
}

// localId ties this counter row to the bill so saveManualEntryBill() can fill in its
// content once the bill is complete (admin day export).
export function trackManualEntry(localId) {
  fetch('/api/analytics/manual-entry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ localId }),
  }).catch(() => {
    // analytics failures should never affect the app
  })
}

// Readable for the admin export: shares keyed by member name instead of internal ids
// ({ Ali: 1, Me: 2 }). Duplicate names get a " (2)" suffix so their shares don't merge.
// Same shape as the bot's buildManualBillData() (backend bot/newBillHandlers.js).
function buildManualBillData(bill) {
  const members = (bill._adhocMembers || []).filter((m) => (bill.activeMembers || []).includes(m.id))
  const nameById = {}
  const seen = {}
  members.forEach((m) => {
    seen[m.name] = (seen[m.name] || 0) + 1
    nameById[m.id] = seen[m.name] > 1 ? `${m.name} (${seen[m.name]})` : m.name
  })

  return {
    members: Object.values(nameById),
    items: (bill.items || []).map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      price: i.price,
      everyone: !!i.everyone,
      shares: Object.fromEntries(Object.entries(i.shares || {}).map(([id, qty]) => [nameById[id] || id, qty])),
    })),
    grandTotal: bill.grandTotal ?? null,
    tipAmount: bill.tipAmount ?? null,
    tipPercent: bill.tipPercent ?? null,
    discountAmount: bill.discountAmount ?? null,
    currency: getCurrency(),
    crewName: bill.crewName || null,
  }
}

// The Itemizer re-saves the bill on every edit while it's balanced, so debounce to send
// only the settled version.
let manualBillTimer = null
export function saveManualEntryBill(bill) {
  clearTimeout(manualBillTimer)
  manualBillTimer = setTimeout(() => {
    fetch(`/api/analytics/manual-entry/${encodeURIComponent(bill.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ billData: buildManualBillData(bill) }),
    }).catch(() => {
      // analytics failures should never affect the app
    })
  }, 1500)
}

export function trackVoiceEntry() {
  fetch('/api/analytics/voice-entry', { method: 'POST' }).catch(() => {
    // analytics failures should never affect the app
  })
}
