import React from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { SCREENS } from '../hooks/useBillApp'
import { generateId } from '../utils/math'
import Sidebar from './components/Sidebar'
import DesktopHome from './components/DesktopHome'
import DesktopCrews from './components/DesktopCrews'
import DesktopHistory from './components/DesktopHistory'
import DesktopBillSetup from './components/DesktopBillSetup'
import DesktopItemizer from './components/DesktopItemizer'
import DesktopSummary from './components/DesktopSummary'
import SettleUp from '../components/SettleUp'

export default function DesktopApp({ crews, setCrews, recentBills, screen, bill, setBill, navigate, startNewBillWithCrew, saveBillToRecent, onOpenStats }) {
  const [collapsed, setCollapsed] = useLocalStorage('tabup_sidebar_collapsed', false)

  function navFromSidebar(target) {
    if (target === SCREENS.HOME) navigate(SCREENS.HOME)
    else navigate(target)
  }

  return (
    <div className="h-screen flex bg-desktop-content font-desktop overflow-hidden">
      <Sidebar
        screen={screen === SCREENS.SETUP || screen === SCREENS.ITEMS || screen === SCREENS.REPORT || screen === SCREENS.SETTLE ? null : screen}
        onNavigate={navFromSidebar}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((p) => !p)}
        onStatsClick={onOpenStats}
      />

      <div className="flex-1 min-w-0 overflow-y-auto">
        {screen === SCREENS.HOME && (
          <DesktopHome
            crews={crews}
            recentBills={recentBills}
            onStartNewBill={() => navigate(SCREENS.SETUP, { id: generateId(), crewId: null, crewName: '', crewEmoji: '🍽️', activeMembers: [], grandTotal: '', taxAmount: '', tipPercent: 18, items: [] })}
            onSelectCrew={startNewBillWithCrew}
            onManageCrews={() => navigate(SCREENS.CREWS)}
            onViewBill={(b) => navigate(SCREENS.REPORT, b)}
            onViewAllBills={() => navigate(SCREENS.HISTORY)}
          />
        )}

        {screen === SCREENS.HISTORY && (
          <DesktopHistory
            recentBills={recentBills}
            onViewBill={(b) => navigate(SCREENS.REPORT, b)}
          />
        )}

        {screen === SCREENS.CREWS && (
          <DesktopCrews
            crews={crews}
            setCrews={setCrews}
            onStartBillWithCrew={startNewBillWithCrew}
          />
        )}

        {screen === SCREENS.SETUP && (
          <DesktopBillSetup
            bill={bill}
            crews={crews}
            onBack={() => navigate(SCREENS.HOME)}
            onNext={(updatedBill) => navigate(SCREENS.ITEMS, updatedBill)}
          />
        )}

        {screen === SCREENS.ITEMS && (
          <DesktopItemizer
            bill={bill}
            onBack={(updatedBill) => navigate(SCREENS.SETUP, updatedBill)}
            onNext={(updatedBill) => saveBillToRecent(updatedBill)}
            onChange={(updatedBill) => setBill(updatedBill)}
            onReset={() => navigate(SCREENS.HOME)}
            onSettleUp={() => navigate(SCREENS.SETTLE, bill)}
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
        )}

        {screen === SCREENS.REPORT && (
          <DesktopSummary
            bill={bill}
            onReset={() => navigate(SCREENS.HOME)}
            onSettleUp={() => navigate(SCREENS.SETTLE, bill)}
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
        )}

        {screen === SCREENS.SETTLE && (
          <div className="flex justify-center" style={{ padding: '40px 44px' }}>
            <div className="w-full max-w-[500px] bg-white rounded-2xl shadow-sm border border-desktop-cardBorder overflow-hidden [&>div]:min-h-0">
              <SettleUp
                bill={bill}
                onBack={() => navigate(SCREENS.REPORT, bill)}
                onChange={(updatedBill) => {
                  setBill(updatedBill)
                  saveBillToRecent(updatedBill)
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
