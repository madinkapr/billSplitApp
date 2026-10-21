import React from 'react'
import { Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCurrency } from '../hooks/useCurrency'
import { useLanguage, LANGUAGES } from '../hooks/usePrefs'
import Menu, { MenuLabel, MenuOption } from '../ui/Menu'

const prefButton =
  'w-full inline-flex items-center justify-center gap-2 min-h-[44px] px-2.5 rounded-ctl border border-line bg-surface text-[15px] font-semibold text-ink hover:bg-surface-2'

function LanguageOptions({ close }) {
  const { language, setLanguage } = useLanguage()
  return LANGUAGES.map((l) => (
    <MenuOption key={l.code} selected={language === l.code} onSelect={() => { setLanguage(l.code); close() }}>
      {l.label}
    </MenuOption>
  ))
}

function CurrencyOptions({ close }) {
  const { t } = useTranslation()
  const { currency, setCurrency, CURRENCIES } = useCurrency()
  return Object.values(CURRENCIES).map((c) => (
    <MenuOption key={c.code} selected={currency === c.code} onSelect={() => { setCurrency(c.code); close() }}>
      {t(`currency.${c.code.toLowerCase()}`)} ({c.symbol})
    </MenuOption>
  ))
}

// Sidebar footer: two buttons side by side, menus open upward.
export function SidebarPrefs() {
  const { t } = useTranslation()
  const { label } = useLanguage()
  const { symbol } = useCurrency()
  return (
    <div className="grid grid-cols-2 gap-2">
      <Menu side="top" align="start" trigger={(p) => <button type="button" {...p} className={prefButton} aria-label={`${t('language.picker')}: ${label}`}>{label}</button>}>
        {(close) => <LanguageOptions close={close} />}
      </Menu>
      <Menu side="top" trigger={(p) => <button type="button" {...p} className={prefButton} aria-label={`${t('currency.picker')}: ${symbol}`}>{symbol}</button>}>
        {(close) => <CurrencyOptions close={close} />}
      </Menu>
    </div>
  )
}

// Phone top bar: one globe button with both lists.
export function TopBarPrefs() {
  const { t } = useTranslation()
  return (
    <Menu
      trigger={(p) => (
        <button type="button" {...p} aria-label={t('shell.prefs')} className="w-11 h-11 inline-flex items-center justify-center rounded-full border border-line bg-surface text-ink hover:bg-surface-2">
          <Globe size={20} aria-hidden="true" />
        </button>
      )}
    >
      {(close) => (
        <>
          <MenuLabel>{t('language.picker')}</MenuLabel>
          <LanguageOptions close={close} />
          <div className="my-1 border-t border-line" />
          <MenuLabel>{t('currency.picker')}</MenuLabel>
          <CurrencyOptions close={close} />
        </>
      )}
    </Menu>
  )
}
