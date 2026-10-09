import React, { useState } from 'react'
import { LogIn, LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import ResendVerificationButton from './ResendVerificationButton'

function Avatar({ user, size }) {
  const initial = (user.name || user.email || '?').trim().charAt(0).toUpperCase()
  if (user.avatarUrl) {
    return <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />
  }
  return (
    <span className="rounded-full bg-white text-indigo-700 font-bold flex items-center justify-center flex-shrink-0" style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {initial}
    </span>
  )
}

// Sign-in button or the signed-in user with a sign-out menu. Two looks, both on a dark
// background: `sidebar` (desktop sidebar footer, menu opens upward) and `header`
// (mobile home header, a round button whose menu opens downward).
export default function UserMenu({ variant = 'sidebar', collapsed = false, onOpenLogin, hideWhenGuest = false }) {
  const { t } = useTranslation()
  const { user, loading, logout } = useAuth()
  const [open, setOpen] = useState(false)

  if (loading) return null

  if (!user) {
    if (hideWhenGuest) return null
    return variant === 'header' ? (
      <button
        onClick={() => onOpenLogin?.('login')}
        className="h-9 px-3 flex items-center gap-1.5 rounded-full bg-white/15 active:bg-white/25 transition-colors text-sm font-semibold"
      >
        <LogIn size={16} />
        {t('auth.signIn')}
      </button>
    ) : (
      <button
        onClick={() => onOpenLogin?.('login')}
        className="w-full flex items-center gap-2 rounded-[10px] bg-white text-desktop-sidebar hover:bg-white/90 transition-colors px-3 py-2 text-[13px] font-semibold"
      >
        <LogIn size={15} className="flex-shrink-0" />
        {!collapsed && <span className="flex-1 text-left truncate">{t('auth.signIn')}</span>}
      </button>
    )
  }

  const menu = (
    <>
      <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
      <div
        className={`absolute z-40 bg-white rounded-xl shadow-lg border border-gray-100 py-1 w-56 text-gray-800 ${
          variant === 'header' ? 'right-0 top-11' : 'left-0 bottom-full mb-2'
        }`}
      >
        <div className="px-3 py-2 border-b border-gray-100">
          <p className="text-sm font-semibold truncate">{user.name || user.email}</p>
          <p className="text-xs text-gray-400 truncate">{user.email}</p>
          {!user.emailVerified && (
            <div className="mt-1.5 flex flex-col items-start gap-0.5">
              <p className="text-xs font-medium text-amber-600">{t('auth.verifyUnconfirmed')}</p>
              <ResendVerificationButton className="text-xs font-semibold text-indigo-600 hover:underline" />
            </div>
          )}
        </div>
        <button
          onClick={async () => {
            setOpen(false)
            await logout()
          }}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut size={15} />
          {t('auth.signOut')}
        </button>
      </div>
    </>
  )

  if (variant === 'header') {
    return (
      <div className="relative">
        <button onClick={() => setOpen((p) => !p)} className="w-9 h-9 rounded-full ring-2 ring-white/30 flex items-center justify-center" aria-label={t('auth.account')}>
          <Avatar user={user} size={36} />
        </button>
        {open && menu}
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-2 rounded-[10px] bg-white/[.08] hover:bg-white/[.14] transition-colors px-2 py-1.5 text-white/90 text-[13px] font-medium"
      >
        <Avatar user={user} size={26} />
        {!collapsed && <span className="flex-1 text-left truncate">{user.name || user.email}</span>}
      </button>
      {open && menu}
    </div>
  )
}
