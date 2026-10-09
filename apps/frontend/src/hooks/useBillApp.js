import { useState, useEffect, useRef } from 'react'
import { useLocalStorage } from './useLocalStorage'
import { useAuth } from './useAuth'
import { generateId } from '../utils/math'
import { saveManualEntryBill } from '../utils/analytics'
import * as userData from '../utils/userData'

const GUEST_BILLS_LIMIT = 50
const ACCOUNT_BILLS_LIMIT = 100

// Puts a finished bill at the top of the history, keeping the date it was first saved.
function addToHistory(prev, finalBill, limit) {
  const existing = prev.find((b) => b.id === finalBill.id)
  const saved = { ...finalBill, createdAt: existing?.createdAt ?? finalBill.createdAt ?? Date.now() }
  return { saved, list: [saved, ...prev.filter((b) => b.id !== finalBill.id)].slice(0, limit) }
}

export const SCREENS = { HOME: 'home', CREWS: 'crews', SETUP: 'setup', ITEMS: 'items', REPORT: 'report', HISTORY: 'history' }

export const SCREEN_ORDER = [SCREENS.HOME, SCREENS.CREWS, SCREENS.SETUP, SCREENS.ITEMS, SCREENS.REPORT, SCREENS.HISTORY]

export function useBillApp() {
  const { user, loading: authLoading } = useAuth()
  // Guests: groups and history stay in this browser only.
  const [localCrews, setLocalCrews] = useLocalStorage('tabup_crews', [])
  const [localBills, setLocalBills] = useLocalStorage('tabup_recent_bills', [])
  // Signed-in: { userId, crews, bills } loaded from the server (null until loaded). The ref
  // mirrors it so back-to-back updates in one tick each see the previous one's result.
  const [account, setAccountState] = useState(null)
  const accountRef = useRef(null)
  const [screen, setScreen] = useState(SCREENS.HOME)
  const [prevScreen, setPrevScreen] = useState(SCREENS.HOME)
  const [bill, setBill] = useState(null)

  // One-time cleanup: an earlier bug bulk-stamped every dateless bill with the same
  // Date.now() on load. Real saves never share an identical millisecond timestamp, so any
  // group of entries with the exact same createdAt is that bug's fingerprint — strip it
  // back to "unknown date" rather than keep showing a fabricated day. Unaffected entries
  // (unique timestamps, including genuinely-today saves) are left untouched.
  useEffect(() => {
    setLocalBills((prev) => {
      const counts = {}
      prev.forEach((b) => {
        if (b.createdAt) counts[b.createdAt] = (counts[b.createdAt] || 0) + 1
      })
      if (!Object.values(counts).some((c) => c > 1)) return prev
      return prev.map((b) => (b.createdAt && counts[b.createdAt] > 1 ? { ...b, createdAt: undefined } : b))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function setAccount(next) {
    accountRef.current = next
    setAccountState(next)
  }

  // On sign-in (or page load while signed in): anything collected as a guest in this
  // browser joins the account, then the browser copy is cleared — so signing out leaves
  // nothing behind and the next guest on this device starts empty. If the request fails
  // the local copy stays and is offered again on the next load.
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setAccount(null)
      return
    }
    let cancelled = false
    const hasGuestData = localCrews.length > 0 || localBills.length > 0
    const request = hasGuestData ? userData.importGuestData(localCrews, localBills) : userData.loadUserData()
    request
      .then((data) => {
        if (cancelled) return
        if (hasGuestData) {
          setLocalCrews([])
          setLocalBills([])
        }
        setAccount({ userId: user.id, crews: data.crews || [], bills: data.bills || [] })
      })
      .catch((err) => {
        console.error('Loading account data failed:', err.message)
        if (!cancelled) setAccount({ userId: user.id, crews: [], bills: [] })
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading])

  // The loaded account data, if it belongs to whoever is signed in right now.
  function currentAccount() {
    const acc = accountRef.current
    return user && acc && acc.userId === user.id ? acc : null
  }

  const signedIn = !!user && !authLoading
  const accountReady = signedIn && account?.userId === user.id
  const crews = signedIn ? (accountReady ? account.crews : []) : localCrews
  const recentBills = signedIn ? (accountReady ? account.bills : []) : localBills

  // Same contract as a useState setter (value or updater), so the crew screens don't care
  // where groups are stored. Signed in: saves changed groups and deletes removed ones.
  function setCrews(update) {
    const acc = currentAccount()
    if (!acc) return setLocalCrews(update)
    const prev = acc.crews
    const next = typeof update === 'function' ? update(prev) : update
    setAccount({ ...acc, crews: next })
    const nextIds = new Set(next.map((c) => c.id))
    next.forEach((c) => !prev.includes(c) && userData.saveCrew(c))
    prev.forEach((c) => !nextIds.has(c.id) && userData.deleteCrew(c.id))
  }

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
    if (finalBill._manualEntry) saveManualEntryBill(finalBill)
    const acc = currentAccount()
    if (acc) {
      const { saved, list } = addToHistory(acc.bills, finalBill, ACCOUNT_BILLS_LIMIT)
      setAccount({ ...acc, bills: list })
      userData.saveBill(saved)
    } else {
      setLocalBills((prev) => addToHistory(prev, finalBill, GUEST_BILLS_LIMIT).list)
    }
  }

  return {
    crews,
    setCrews,
    recentBills,
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
