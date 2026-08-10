import React, { useState } from 'react'
import { Home, Users, Clock, ChevronsLeft, ChevronsRight, Globe, Coins, Check, ChevronDown, BarChart2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import { useCurrency } from '../../hooks/useCurrency'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { SCREENS } from '../../hooks/useBillApp'

const LANGUAGES = [
  { code: 'uz', label: "O'zbek" },
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
]

const NAV_ITEMS = [
  { screen: SCREENS.HOME, icon: Home, labelKey: 'nav.home' },
  { screen: SCREENS.CREWS, icon: Users, labelKey: 'nav.crews' },
  { screen: SCREENS.HISTORY, icon: Clock, labelKey: 'nav.history' },
]

function FooterPill({ icon: Icon, value, open, onToggle, children, collapsed }) {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 rounded-[10px] bg-white/[.08] hover:bg-white/[.14] transition-colors px-3 py-2 text-white/85 text-[13px] font-medium"
      >
        <Icon size={15} className="flex-shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1 text-left truncate">{value}</span>
            <ChevronDown size={13} className="flex-shrink-0 opacity-70" />
          </>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={onToggle} />
          <div className="absolute left-0 bottom-full mb-2 bg-white rounded-xl shadow-lg border border-gray-100 py-1 w-40 z-40 text-gray-800">
            {children}
          </div>
        </>
      )}
    </div>
  )
}

export default function Sidebar({ screen, onNavigate, collapsed, onToggleCollapse, statsActive = false, onStatsClick }) {
  const { t, i18n } = useTranslation()
  const { currency, setCurrency, CURRENCIES } = useCurrency()
  const [language, setLanguage] = useLocalStorage('tabup_language', 'ru')
  const [langOpen, setLangOpen] = useState(false)
  const [currencyOpen, setCurrencyOpen] = useState(false)
  const isAdmin = useIsAdmin()

  function changeLanguage(code) {
    setLanguage(code)
    i18n.changeLanguage(code)
    setLangOpen(false)
  }

  return (
    <div
      className={`flex flex-col flex-shrink-0 bg-desktop-sidebar font-desktop transition-[width] duration-200 ${collapsed ? 'w-16' : 'w-[236px]'}`}
      style={{ padding: collapsed ? '28px 10px' : '28px 18px', boxSizing: 'border-box' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-8">
        {!collapsed && (
          <img src="/logo-schet-white.png" alt="SCHET.uz" className="h-9 w-auto object-contain flex-1 min-w-0" />
        )}
        {!collapsed && (
          <button
            onClick={onToggleCollapse}
            aria-label={t('nav.collapse')}
            className="w-[26px] h-[26px] rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center flex-shrink-0"
          >
            <ChevronsLeft size={14} className="text-white/80" />
          </button>
        )}
      </div>
      {collapsed && (
        <button
          onClick={onToggleCollapse}
          aria-label={t('nav.expand')}
          className="w-[26px] h-[26px] mx-auto -mt-6 mb-6 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center flex-shrink-0"
        >
          <ChevronsRight size={14} className="text-white/80" />
        </button>
      )}

      {/* Nav */}
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ screen: s, icon: Icon, labelKey }) => {
          const active = screen === s
          return (
            <button
              key={s}
              onClick={() => onNavigate(s)}
              className={`flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[14px] transition-colors ${
                active ? 'bg-white/[.12] text-white font-semibold' : 'text-white/70 hover:text-white/90 hover:bg-white/[.06] font-medium'
              }`}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && <span className="truncate">{t(labelKey)}</span>}
            </button>
          )
        })}

        {isAdmin && (
          <a
            href="/admin/stats"
            onClick={(e) => {
              if (!onStatsClick || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
              e.preventDefault()
              onStatsClick()
            }}
            className={`flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[14px] transition-colors ${
              statsActive ? 'bg-white/[.12] text-white font-semibold' : 'text-white/70 hover:text-white/90 hover:bg-white/[.06] font-medium'
            }`}
          >
            <BarChart2 size={18} className="flex-shrink-0" />
            {!collapsed && <span className="truncate">{t('nav.stats')}</span>}
          </a>
        )}
      </nav>

      {/* Footer */}
      <div className="flex flex-col gap-2 mt-auto pt-4">
        <FooterPill
          icon={Globe}
          value={LANGUAGES.find((l) => l.code === language)?.label}
          open={langOpen}
          onToggle={() => { setLangOpen((p) => !p); setCurrencyOpen(false) }}
          collapsed={collapsed}
        >
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => changeLanguage(l.code)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
            >
              <span className={language === l.code ? 'font-semibold text-desktop-primary' : ''}>{l.label}</span>
              {language === l.code && <Check size={14} className="text-desktop-primary" />}
            </button>
          ))}
        </FooterPill>

        <FooterPill
          icon={Coins}
          value={currency}
          open={currencyOpen}
          onToggle={() => { setCurrencyOpen((p) => !p); setLangOpen(false) }}
          collapsed={collapsed}
        >
          {Object.values(CURRENCIES).map((c) => (
            <button
              key={c.code}
              onClick={() => { setCurrency(c.code); setCurrencyOpen(false) }}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
            >
              <span className={currency === c.code ? 'font-semibold text-desktop-primary' : ''}>
                {t(`currency.${c.code.toLowerCase()}`)} ({c.symbol})
              </span>
              {currency === c.code && <Check size={14} className="text-desktop-primary" />}
            </button>
          ))}
        </FooterPill>
      </div>
    </div>
  )
}
