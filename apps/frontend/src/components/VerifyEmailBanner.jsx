import React from 'react'
import { MailWarning } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import ResendVerificationButton from './ResendVerificationButton'

const DAY_MS = 24 * 60 * 60 * 1000
const URGENT_DAYS = 3

// Whole days until the account is deleted (0 = today), or null if it won't be.
function daysLeft(deleteAt) {
  if (!deleteAt) return null
  return Math.max(0, Math.ceil((new Date(deleteAt).getTime() - Date.now()) / DAY_MS))
}

// Home screen notice for an account whose email isn't confirmed yet (until then it has
// guest limits), with a countdown to its deletion; red for the last few days. Disappears
// on its own once the link is clicked — useAuth re-checks.
export default function VerifyEmailBanner({ className = '' }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  if (!user || user.emailVerified) return null

  const days = daysLeft(user.deleteAt)
  const urgent = days !== null && days <= URGENT_DAYS
  const tone = urgent ? 'border-warn bg-warn-tint text-warn' : 'border-warn bg-warn-tint text-warn'

  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 ${tone} ${className}`}>
      <MailWarning size={18} className="mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0 text-sm">
        <p className="font-semibold">{t('auth.verifyBannerTitle')}</p>
        <p className={`mt-0.5 break-words ${urgent ? 'text-warn' : 'text-warn'}`}>
          {t('auth.verifyBannerBody', { email: user.email })}
          {days !== null && (
            <>
              {' '}
              <span className={urgent ? 'font-semibold' : ''}>
                {days === 0 ? t('auth.verifyDeleteToday') : t('auth.verifyDeleteIn', { count: days })}
              </span>
            </>
          )}
        </p>
        <ResendVerificationButton className="mt-1.5 inline-flex items-center font-semibold underline underline-offset-2" />
      </div>
    </div>
  )
}
