import { useState, useEffect } from 'react'
import { useLocalStorage } from './useLocalStorage'
import { generateId } from '../utils/math'

export const SCREENS = { HOME: 'home', CREWS: 'crews', SETUP: 'setup', ITEMS: 'items', REPORT: 'report', SETTLE: 'settle', HISTORY: 'history' }

export const SCREEN_ORDER = [SCREENS.HOME, SCREENS.CREWS, SCREENS.SETUP, SCREENS.ITEMS, SCREENS.REPORT, SCREENS.SETTLE, SCREENS.HISTORY]

export function useBillApp() {
  const [crews, setCrews] = useLocalStorage('tabup_crews', [])
  const [recentBills, setRecentBills] = useLocalStorage('tabup_recent_bills', [])
  const [screen, setScreen] = useState(SCREENS.HOME)
  const [prevScreen, setPrevScreen] = useState(SCREENS.HOME)
  const [bill, setBill] = useState(null)

  // One-time cleanup: an earlier bug bulk-stamped every dateless bill with the same
  // Date.now() on load. Real saves never share an identical millisecond timestamp, so any
  // group of entries with the exact same createdAt is that bug's fingerprint — strip it
  // back to "unknown date" rather than keep showing a fabricated day. Unaffected entries
  // (unique timestamps, including genuinely-today saves) are left untouched.
  useEffect(() => {
    setRecentBills((prev) => {
      const counts = {}
      prev.forEach((b) => {
        if (b.createdAt) counts[b.createdAt] = (counts[b.createdAt] || 0) + 1
      })
      if (!Object.values(counts).some((c) => c > 1)) return prev
      return prev.map((b) => (b.createdAt && counts[b.createdAt] > 1 ? { ...b, createdAt: undefined } : b))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const direction = SCREEN_ORDER.indexOf(screen) >= SCREEN_ORDER.indexOf(prevScreen) ? 1 : -1

  function navigate(to, updatedBill) {
    setPrevScreen(screen)
    if (updatedBill !== undefined) setBill(updatedBill)
    setScreen(to)
  }

  function startNewBillWithCrew(crew) {
    const newBill = {
      id: generateId(),
      crewId: crew.id,
      crewName: crew.name,
      crewEmoji: crew.emoji,
      activeMembers: crew.members.map((m) => m.id),
      grandTotal: '',
      taxAmount: '',
      tipPercent: 18,
      items: [],
    }
    navigate(SCREENS.SETUP, newBill)
  }

  function saveBillToRecent(finalBill) {
    setRecentBills((prev) => {
      const existing = prev.find((b) => b.id === finalBill.id)
      const billWithDate = { ...finalBill, createdAt: existing?.createdAt ?? finalBill.createdAt ?? Date.now() }
      const filtered = prev.filter((b) => b.id !== finalBill.id)
      return [billWithDate, ...filtered].slice(0, 50)
    })
  }

  return {
    crews,
    setCrews,
    recentBills,
    setRecentBills,
    screen,
    prevScreen,
    bill,
    setBill,
    direction,
    navigate,
    startNewBillWithCrew,
    saveBillToRecent,
  }
}
