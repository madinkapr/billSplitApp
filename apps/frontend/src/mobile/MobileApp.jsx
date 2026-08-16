import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { generateId } from '../utils/math'
import { SCREENS } from '../hooks/useBillApp'
import HomeScreen from '../components/HomeScreen'
import CrewManager from '../components/CrewManager'
import BillSetup from '../components/BillSetup'
import Itemizer from '../components/Itemizer'
import Report from '../components/Report'
import BillHistory from '../components/BillHistory'

const slide = {
  initial: (dir) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
  animate: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 0 }),
  transition: { type: 'spring', stiffness: 300, damping: 30 },
}

export default function MobileApp({ crews, setCrews, recentBills, screen, bill, setBill, direction, navigate, startNewBillWithCrew, saveBillToRecent, onOpenStats }) {
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
                onViewAllBills={() => navigate(SCREENS.HISTORY)}
                onOpenStats={onOpenStats}
              />
            </motion.div>
          )}

          {screen === SCREENS.HISTORY && (
            <motion.div key="history" custom={direction} {...slide} className="absolute inset-0 overflow-y-auto">
              <BillHistory
                recentBills={recentBills}
                onBack={() => navigate(SCREENS.HOME)}
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
                onNext={(updatedBill) => saveBillToRecent(updatedBill)}
                onChange={(updatedBill) => setBill(updatedBill)}
              />
            </motion.div>
          )}

          {screen === SCREENS.REPORT && (
            <motion.div key="report" custom={direction} {...slide} className="absolute inset-0 overflow-y-auto">
              <Report bill={bill} onBack={() => navigate(SCREENS.HOME)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
