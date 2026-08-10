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

export function trackManualEntry() {
  fetch('/api/analytics/manual-entry', { method: 'POST' }).catch(() => {
    // analytics failures should never affect the app
  })
}
