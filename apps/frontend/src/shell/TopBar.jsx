import React from 'react'
import Logo from './Logo'
import AccountMenu from './AccountMenu'
import { TopBarPrefs } from './Prefs'

// Phones and tablets, Home only: logo, language/currency, account.
export default function TopBar({ onOpenLogin }) {
  return (
    <header className="lg:hidden flex items-center justify-between gap-2 px-4 sm:px-6 pb-3 pt-[calc(12px+env(safe-area-inset-top))]">
      <Logo />
      <div className="flex items-center gap-2">
        <TopBarPrefs />
        <AccountMenu variant="topbar" onOpenLogin={onOpenLogin} />
      </div>
    </header>
  )
}
