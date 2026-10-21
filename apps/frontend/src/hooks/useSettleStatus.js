import { useCallback, useEffect, useState } from 'react'

// Payment status of a shared bill. Sharing payment links (useSettleShare) creates a server
// bill; its id is kept per local bill id in this browser, so the bill list and the split
// screen can ask GET /api/settle/bills/:id/status who has paid.
const STORAGE_KEY = 'tabup_settle_ids'
const CHANGED_EVENT = 'tabup:settle-ids-changed'
const MAX_AGE_MS = 30 * 1000

const cache = new Map() // server bill id → { at, data }

function readIds() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
  } catch {
    return {}
  }
}

export function rememberSettleBill(localId, serverBillId) {
  if (!localId || !serverBillId) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readIds(), [localId]: serverBillId }))
  } catch {
    // storage full or unavailable — status just won't show
  }
  cache.delete(serverBillId)
  window.dispatchEvent(new Event(CHANGED_EVENT))
}

async function fetchStatus(serverBillId, force) {
  const hit = cache.get(serverBillId)
  if (!force && hit && Date.now() - hit.at < MAX_AGE_MS) return hit.data
  const res = await fetch(`/api/settle/bills/${encodeURIComponent(serverBillId)}/status`)
  if (!res.ok) throw new Error('status_failed')
  const data = await res.json()
  cache.set(serverBillId, { at: Date.now(), data })
  return data
}

// → { shared, loading, data, refresh }. `data.participants` excludes the payer.
export function useSettleStatus(localId) {
  const [serverId, setServerId] = useState(() => readIds()[localId] || null)
  const [state, setState] = useState({ loading: !!serverId, data: null })

  useEffect(() => {
    const sync = () => setServerId(readIds()[localId] || null)
    sync()
    window.addEventListener(CHANGED_EVENT, sync)
    return () => window.removeEventListener(CHANGED_EVENT, sync)
  }, [localId])

  const load = useCallback(
    (force = false) => {
      if (!serverId) {
        setState({ loading: false, data: null })
        return () => {}
      }
      let cancelled = false
      setState((s) => ({ loading: !s.data, data: s.data }))
      fetchStatus(serverId, force)
        .then((data) => !cancelled && setState({ loading: false, data }))
        .catch(() => !cancelled && setState({ loading: false, data: null }))
      return () => {
        cancelled = true
      }
    },
    [serverId]
  )

  useEffect(() => load(), [load])

  return { shared: !!serverId, loading: state.loading, data: state.data, refresh: () => load(true) }
}

// Short summary for lists: how many of the people asked to pay have paid.
export function paidSummary(data) {
  const people = data?.participants || []
  return { paid: people.filter((p) => p.paid).length, total: people.length }
}
