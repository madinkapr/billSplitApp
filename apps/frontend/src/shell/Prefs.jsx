import React, { useState } from 'react'
import { Globe, Sun, Moon, Monitor } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCurrency } from '../hooks/useCurrency'
import { useLanguage, useTheme, LANGUAGES } from '../hooks/usePrefs'
import Menu, { MenuOption } from '../ui/Menu'
import Segmented from '../ui/Segmented'
import Sheet from '../ui/Sheet'

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

function PrefRow({ id, label, children }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h3 id={id} className="text-[15px] font-medium text-ink-2">{label}</h3>
      {children}
    </section>
  )
}

// Phone top bar: the globe opens a settings sheet — language, currency and theme,
// each one row of buttons.
export function TopBarPrefs() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const { language, setLanguage } = useLanguage()
  const { currency, setCurrency, CURRENCIES } = useCurrency()
  const { theme, setTheme } = useTheme()

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('shell.prefs')}
        aria-haspopup="dialog"
        className="w-11 h-11 inline-flex items-center justify-center rounded-full border border-line bg-surface text-ink hover:bg-surface-2"
      >
        <Globe size={20} aria-hidden="true" />
      </button>
      {open && (
        <Sheet title={t('shell.settings')} onClose={() => setOpen(false)}>
          <PrefRow id="pref-language" label={t('language.picker')}>
            <Segmented labelledBy="pref-language" value={language} onChange={setLanguage} options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))} />
          </PrefRow>
          <PrefRow id="pref-currency" label={t('currency.picker')}>
            <Segmented
              labelledBy="pref-currency"
              value={currency}
              onChange={setCurrency}
              options={Object.values(CURRENCIES).map((c) => ({ value: c.code, label: c.symbol, ariaLabel: t(`currency.${c.code.toLowerCase()}`) }))}
            />
          </PrefRow>
          <PrefRow id="pref-theme" label={t('theme.picker')}>
            <Segmented
              labelledBy="pref-theme"
              value={theme}
              onChange={setTheme}
              options={THEME_OPTIONS.map(({ value, icon: Icon }) => ({
                value,
                ariaLabel: t(`theme.${value}`),
                label: (
                  <span className="inline-flex items-center justify-center gap-1.5">
                    <Icon size={16} aria-hidden="true" />
                    {t(`theme.${value}Short`)}
                  </span>
                ),
              }))}
            />
          </PrefRow>
        </Sheet>
      )}
    </>
  )
}
