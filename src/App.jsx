import React, { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useLocalStorage } from './hooks/useLocalStorage'
import { generateId } from './utils/math'
import HomeScreen from './components/HomeScreen'
import CrewManager from './components/CrewManager'
import BillSetup from './components/BillSetup'
import Itemizer from './components/Itemizer'
import Report from './components/Report'

const SCREENS = { HOME: 'home', CREWS: 'crews', SETUP: 'setup', ITEMS: 'items', REPORT: 'report' }

const slide = {
  initial: (dir) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
  animate: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 0 }),
  transition: { type: 'spring', stiffness: 300, damping: 30 },
}

const SCREEN_ORDER = [SCREENS.HOME, SCREENS.CREWS, SCREENS.SETUP, SCREENS.ITEMS, SCREENS.REPORT]

export default function App() {
  const [crews, setCrews] = useLocalStorage('tabup_crews', [])
  const [recentBills, setRecentBills] = useLocalStorage('tabup_recent_bills', [])
  const [screen, setScreen] = useState(SCREENS.HOME)
  const [prevScreen, setPrevScreen] = useState(SCREENS.HOME)
  const [bill, setBill] = useState(null)

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
      const filtered = prev.filter((b) => b.id !== finalBill.id)
      return [finalBill, ...filtered].slice(0, 10)
    })
  }

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center">
      <div className="w-full max-w-[500px] min-h-screen bg-white relative overflow-hidden">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          {screen === SCREENS.HOME && (
            <motion.div key="home" custom={direction} {...slide} className="absolute inset-0 overflow-y-auto">
              <HomeScreen
                crews={crews}
                recentBills={recentBills}
                onStartNewBill={() => navigate(SCREENS.SETUP, { id: generateId(), crewId: null, crewName: '', crewEmoji: '🍽️', activeMembers: [], grandTotal: '', taxAmount: '', tipPercent: 18, items: [] })}
                onSelectCrew={startNewBillWithCrew}
                onManageCrews={() => navigate(SCREENS.CREWS)}
                onViewBill={(bill) => navigate(SCREENS.REPORT, bill)}
              />
            </motion.div>
          )}

          {screen === SCREENS.CREWS && (
            <motion.div key="crews" custom={direction} {...slide} className="absolute inset-0 overflow-y-auto">
              <CrewManager
                crews={crews}
                setCrews={setCrews}
                onBack={() => navigate(SCREENS.HOME)}
                onStartBillWithCrew={startNewBillWithCrew}
              />
            </motion.div>
          )}

          {screen === SCREENS.SETUP && (
            <motion.div key="setup" custom={direction} {...slide} className="absolute inset-0 overflow-y-auto">
              <BillSetup
                bill={bill}
                crews={crews}
                onBack={() => navigate(SCREENS.HOME)}
                onNext={(updatedBill) => navigate(SCREENS.ITEMS, updatedBill)}
              />
            </motion.div>
          )}

          {screen === SCREENS.ITEMS && (
            <motion.div key="items" custom={direction} {...slide} className="absolute inset-0 overflow-y-auto">
              <Itemizer
                bill={bill}
                onBack={(updatedBill) => navigate(SCREENS.SETUP, updatedBill)}
                onNext={(updatedBill) => {
                  saveBillToRecent(updatedBill)
                  navigate(SCREENS.REPORT, updatedBill)
                }}
                onChange={(updatedBill) => setBill(updatedBill)}
              />
            </motion.div>
          )}

          {screen === SCREENS.REPORT && (
            <motion.div key="report" custom={direction} {...slide} className="absolute inset-0 overflow-y-auto">
              <Report
                bill={bill}
                onReset={() => navigate(SCREENS.HOME)}
                onNewWithSameCrew={() => {
                  if (bill) {
                    const crew = crews.find((c) => c.id === bill.crewId)
                    if (crew) startNewBillWithCrew(crew)
                    else navigate(SCREENS.HOME)
                  } else {
                    navigate(SCREENS.HOME)
                  }
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
