import React from 'react'
import { Globe, Sun, Moon, Monitor } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCurrency } from '../hooks/useCurrency'
import { useLanguage, useTheme, LANGUAGES } from '../hooks/usePrefs'
import Menu, { MenuLabel, MenuOption } from '../ui/Menu'
import Segmented from '../ui/Segmented'

const THEME_OPTIONS = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
  { value: 'system', icon: Monitor },
]

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

function ThemeOptions({ close }) {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()
  return THEME_OPTIONS.map(({ value, icon: Icon }) => (
    <MenuOption key={value} selected={theme === value} onSelect={() => { setTheme(value); close() }}>
      <span className="inline-flex items-center gap-2">
        <Icon size={16} aria-hidden="true" />
        {t(`theme.${value}`)}
      </span>
    </MenuOption>
  ))
}

// Light / dark / auto as three icon buttons.
function ThemeSwitch() {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()
  return (
    <>
      <span id="theme-label" className="sr-only">{t('theme.picker')}</span>
      <Segmented
        labelledBy="theme-label"
        value={theme}
        onChange={setTheme}
        options={THEME_OPTIONS.map(({ value, icon: Icon }) => ({
          value,
          ariaLabel: t(`theme.${value}`),
          label: <Icon size={18} className="mx-auto" aria-hidden="true" />,
        }))}
      />
    </>
  )
}

// Sidebar footer: the theme switch, then language and currency (menus open upward).
export function SidebarPrefs() {
  const { t } = useTranslation()
  const { label } = useLanguage()
  const { symbol } = useCurrency()
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="col-span-2">
        <ThemeSwitch />
      </div>
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
          <div className="my-1 border-t border-line" />
          <MenuLabel>{t('theme.picker')}</MenuLabel>
          <ThemeOptions close={close} />
        </>
      )}
    </Menu>
  )
}
