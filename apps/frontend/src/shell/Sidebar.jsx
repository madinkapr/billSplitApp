import React from 'react'
import { Home, Users, Clock, MapPin, Plus, BarChart2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SCREENS } from '../hooks/useBillApp'
import { useIsAdmin } from '../hooks/useIsAdmin'
import { inAppLinkClick } from '../utils/navigate'
import Logo from './Logo'
import AccountMenu from './AccountMenu'
import { SidebarPrefs } from './Prefs'

export const NAV_ITEMS = [
  { screen: SCREENS.HOME, icon: Home, labelKey: 'shell.tabs.home' },
  { screen: SCREENS.CREWS, icon: Users, labelKey: 'shell.tabs.crews' },
  { screen: SCREENS.HISTORY, icon: Clock, labelKey: 'shell.tabs.history' },
  { screen: SCREENS.CAFES, icon: MapPin, labelKey: 'shell.tabs.cafes' },
]

const itemClass = (active) =>
  `flex items-center gap-3 min-h-[44px] px-3 rounded-[10px] text-[15px] ${
    active ? 'bg-accent-tint text-accent-ink font-semibold' : 'text-ink-2 font-medium hover:bg-surface-2 hover:text-ink'
  }`

// Desktop (≥1024px) navigation. `active` is the highlighted screen (null inside a bill).
export default function Sidebar({ active, onNavigate, onNewBill, statsActive = false, onOpenStats, onOpenLogin }) {
  const { t } = useTranslation()
  const isAdmin = useIsAdmin()

  return (
    <aside aria-label={t('shell.mainNav')} className="hidden lg:flex flex-col gap-6 w-[248px] flex-none sticky top-0 h-screen overflow-y-auto px-4 py-6 bg-surface border-r border-line">
      <Logo className="px-1" />

      <button type="button" onClick={onNewBill} className="inline-flex items-center justify-center gap-2 min-h-[48px] px-5 rounded-ctl bg-accent text-on-accent text-[16px] font-semibold hover:bg-accent-ink active:scale-[0.97] transition-transform">
        <Plus size={20} aria-hidden="true" />
        {t('shell.newBill')}
      </button>

      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ screen, icon: Icon, labelKey }) => (
          <button key={screen} type="button" onClick={() => onNavigate(screen)} aria-current={active === screen ? 'page' : undefined} className={itemClass(active === screen)}>
            <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
            {t(labelKey)}
          </button>
        ))}
        {isAdmin && (
          <a
            href="/admin/stats"
            onClick={(e) => {
              if (!onOpenStats || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
              e.preventDefault()
              onOpenStats()
            }}
            aria-current={statsActive ? 'page' : undefined}
            className={itemClass(statsActive)}
          >
            <BarChart2 size={22} strokeWidth={1.8} aria-hidden="true" />
            {t('nav.stats')}
          </a>
        )}
      </nav>

      <div className="mt-auto flex flex-col gap-2">
        <SidebarPrefs />
        {onOpenLogin && <AccountMenu variant="sidebar" onOpenLogin={onOpenLogin} />}
        <a href="/privacy" onClick={inAppLinkClick('/privacy')} className="self-start inline-flex items-center min-h-[32px] px-1 text-[13px] text-ink-2 hover:text-ink hover:underline">
          {t('legal.privacy')}
        </a>
      </div>
    </aside>
  )
}
