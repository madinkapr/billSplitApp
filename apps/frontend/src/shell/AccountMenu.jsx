import React from 'react'
import { LogIn, LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import Avatar from '../ui/Avatar'
import Menu from '../ui/Menu'
import ResendVerificationButton from '../components/ResendVerificationButton'

function AccountPanel({ user, close, logout }) {
  const { t } = useTranslation()
  return (
    <div className="w-64">
      <div className="px-3 py-2 border-b border-line">
        <p className="text-[15px] font-semibold truncate">{user.name || user.email}</p>
        <p className="text-[13px] text-ink-2 truncate">{user.email}</p>
        {!user.emailVerified && (
          <div className="mt-1.5 flex flex-col items-start gap-0.5">
            <p className="text-[13px] font-medium text-warn">{t('auth.verifyUnconfirmed')}</p>
            <ResendVerificationButton className="text-[13px] font-semibold text-link hover:underline" />
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={async () => {
          close()
          await logout()
        }}
        className="w-full flex items-center gap-2 px-3 min-h-[44px] text-[15px] text-ink hover:bg-surface-2"
      >
        <LogOut size={16} aria-hidden="true" />
        {t('auth.signOut')}
      </button>
    </div>
  )
}

// Signed in: avatar + menu with sign-out. Guest: a sign-in button.
// `sidebar` is the desktop footer row, `topbar` the round button on phones.
export default function AccountMenu({ variant = 'sidebar', onOpenLogin }) {
  const { t } = useTranslation()
  const { user, loading, logout } = useAuth()

  if (loading) {
    return variant === 'sidebar' ? <div className="h-[52px] rounded-ctl bg-surface-2 animate-pulse" /> : <div className="w-11 h-11 rounded-full bg-surface-2 animate-pulse" />
  }

  if (!user) {
    return variant === 'sidebar' ? (
      <button
        type="button"
        onClick={() => onOpenLogin?.('login')}
        className="w-full flex items-center gap-2.5 min-h-[52px] px-2 rounded-ctl border border-line text-left hover:bg-surface-2"
      >
        <span className="w-9 h-9 rounded-full bg-accent-tint text-accent-ink inline-flex items-center justify-center flex-none">
          <LogIn size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <b className="block text-[15px] font-semibold">{t('auth.signIn')}</b>
          <small className="block text-[13px] text-ink-2 truncate">{t('shell.guestSubtitle')}</small>
        </span>
      </button>
    ) : (
      <button
        type="button"
        onClick={() => onOpenLogin?.('login')}
        className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-full border border-line bg-surface text-[15px] font-semibold hover:bg-surface-2"
      >
        <LogIn size={18} aria-hidden="true" />
        {t('auth.signIn')}
      </button>
    )
  }

  const name = user.name || user.email

  if (variant === 'topbar') {
    return (
      <Menu
        trigger={(p) => (
          <button type="button" {...p} aria-label={t('auth.account')} className="w-11 h-11 rounded-full inline-flex items-center justify-center">
            <Avatar name={name} id={user.id} src={user.avatarUrl} size="lg" tone="a1" />
          </button>
        )}
      >
        {(close) => <AccountPanel user={user} close={close} logout={logout} />}
      </Menu>
    )
  }

  return (
    <Menu
      side="top"
      align="start"
      trigger={(p) => (
        <button type="button" {...p} className="w-full flex items-center gap-2.5 min-h-[52px] px-2 rounded-ctl border border-line text-left hover:bg-surface-2">
          <Avatar name={name} id={user.id} src={user.avatarUrl} tone="a1" />
          <span className="min-w-0">
            <b className="block text-[15px] font-semibold truncate">{name}</b>
            <small className="block text-[13px] text-ink-2 truncate">{t('shell.accountSubtitle')}</small>
          </span>
        </button>
      )}
    >
      {(close) => <AccountPanel user={user} close={close} logout={logout} />}
    </Menu>
  )
}
