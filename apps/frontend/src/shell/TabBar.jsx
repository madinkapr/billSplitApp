import React from 'react'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NAV_ITEMS } from './Sidebar'

// Phones and tablets (<1024px): four tabs around a "New bill" button.
export default function TabBar({ active, onNavigate, onNewBill }) {
  const { t } = useTranslation()
  const tab = ({ screen, icon: Icon, labelKey }) => (
    <button
      key={screen}
      type="button"
      onClick={() => onNavigate(screen)}
      aria-current={active === screen ? 'page' : undefined}
      className={`flex flex-col items-center gap-0.5 min-h-[48px] min-w-0 text-[13px] leading-tight ${active === screen ? 'text-link font-semibold' : 'text-ink-2 font-medium'}`}
    >
      <Icon size={24} strokeWidth={1.8} aria-hidden="true" />
      <span className="max-w-full truncate">{t(labelKey)}</span>
    </button>
  )

  return (
    <nav aria-label={t('shell.mainNav')} className="lg:hidden sticky bottom-0 z-20 grid grid-cols-5 items-start bg-surface border-t border-line px-2 pt-2 pb-[calc(10px+env(safe-area-inset-bottom))]">
      {NAV_ITEMS.slice(0, 2).map(tab)}
      <button
        type="button"
        onClick={onNewBill}
        aria-label={t('shell.newBill')}
        className="justify-self-center -mt-[22px] w-14 h-14 rounded-full bg-accent text-on-accent shadow-fab inline-flex items-center justify-center active:scale-95 transition-transform"
      >
        <Plus size={26} strokeWidth={2.2} aria-hidden="true" />
      </button>
      {NAV_ITEMS.slice(2).map(tab)}
    </nav>
  )
}
