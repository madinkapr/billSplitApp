import React, { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { SCREENS } from '../hooks/useBillApp'
import { useIsDesktop } from '../hooks/useIsDesktop'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import TabBar from './TabBar'
import HomeScreen from '../components/HomeScreen'
import DesktopHome from '../desktop/components/DesktopHome'
import CrewManager from '../components/CrewManager'
import DesktopCrews from '../desktop/components/DesktopCrews'
import BillHistory from '../components/BillHistory'
import DesktopHistory from '../desktop/components/DesktopHistory'
import BillSetup from '../components/BillSetup'
import DesktopBillSetup from '../desktop/components/DesktopBillSetup'
import Itemizer from '../components/Itemizer'
import DesktopItemizer from '../desktop/components/DesktopItemizer'
import Report from '../components/Report'
import DesktopSummary from '../desktop/components/DesktopSummary'
import CafesMap from '../components/CafesMap'

// Screens inside a bill: no tab bar (they have their own bottom action bar) and no
// highlighted nav item.
const FLOW_SCREENS = [SCREENS.SETUP, SCREENS.ITEMS, SCREENS.REPORT]

const fade = {
  initial: (dir) => ({ opacity: 0, x: dir > 0 ? 16 : -16 }),
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0 },
  transition: { duration: 0.16, ease: 'easeOut' },
}

// One responsive app frame (mobile-first): top bar + tab bar below 1024px, sidebar above.
export default function AppShell({ crews, setCrews, recentBills, screen, bill, setBill, direction, navigate, startNewBill, startNewBillWithCrew, saveBillToRecent, onOpenStats, onOpenLogin }) {
  const isDesktop = useIsDesktop()
  const inFlow = FLOW_SCREENS.includes(screen)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [screen])

  function renderScreen() {
    switch (screen) {
      case SCREENS.HOME: {
        const props = {
          crews,
          recentBills,
          onStartNewBill: () => startNewBill(),
          onSelectCrew: startNewBillWithCrew,
          onManageCrews: () => navigate(SCREENS.CREWS),
          onViewBill: (b) => navigate(SCREENS.REPORT, b),
          onViewAllBills: () => navigate(SCREENS.HISTORY),
          onOpenCafes: () => navigate(SCREENS.CAFES),
          onOpenStats,
          onOpenLogin,
        }
        return isDesktop ? <DesktopHome {...props} /> : <HomeScreen {...props} />
      }
      case SCREENS.CREWS: {
        const props = { crews, setCrews, onBack: () => navigate(SCREENS.HOME), onStartBillWithCrew: startNewBillWithCrew }
        return isDesktop ? <DesktopCrews {...props} /> : <CrewManager {...props} />
      }
      case SCREENS.HISTORY: {
        const props = { recentBills, onBack: () => navigate(SCREENS.HOME), onViewBill: (b) => navigate(SCREENS.REPORT, b) }
        return isDesktop ? <DesktopHistory {...props} /> : <BillHistory {...props} />
      }
      case SCREENS.CAFES:
        return <CafesMap className="flex-1 min-h-[360px] block" />
      case SCREENS.SETUP: {
        const props = { bill, crews, onBack: () => navigate(SCREENS.HOME), onNext: (b) => navigate(SCREENS.ITEMS, b) }
        return isDesktop ? <DesktopBillSetup {...props} /> : <BillSetup {...props} />
      }
      case SCREENS.ITEMS: {
        const props = {
          bill,
          onBack: (b) => navigate(SCREENS.SETUP, b),
          onNext: (b) => saveBillToRecent(b),
          onChange: (b) => setBill(b),
        }
        return isDesktop ? <DesktopItemizer {...props} /> : <Itemizer {...props} />
      }
      case SCREENS.REPORT:
        return isDesktop ? <DesktopSummary bill={bill} /> : <Report bill={bill} onBack={() => navigate(SCREENS.HOME)} />
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen flex bg-bg text-ink">
      <Sidebar
        active={inFlow ? null : screen}
        onNavigate={navigate}
        onNewBill={() => startNewBill()}
        onOpenStats={onOpenStats}
        onOpenLogin={onOpenLogin}
      />

      <div className="flex-1 min-w-0 min-h-screen flex flex-col">
        {screen === SCREENS.HOME && <TopBar onOpenLogin={onOpenLogin} />}

        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.main key={screen} custom={direction} {...fade} className="flex-1 min-w-0 flex flex-col">
            {renderScreen()}
          </motion.main>
        </AnimatePresence>

        {!inFlow && <TabBar active={screen} onNavigate={navigate} onNewBill={() => startNewBill()} />}
      </div>
    </div>
  )
}
