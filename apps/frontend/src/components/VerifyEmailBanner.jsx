import React from 'react'
import { MailWarning } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import ResendVerificationButton from './ResendVerificationButton'

// Home screen notice for an account whose email isn't confirmed yet (until then it has
// guest limits). Disappears on its own once the link is clicked — useAuth re-checks.
export default function VerifyEmailBanner({ className = '' }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  if (!user || user.emailVerified) return null

  return (
    <div className={`flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-amber-900 ${className}`}>
      <MailWarning size={18} className="mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0 text-sm">
        <p className="font-semibold">{t('auth.verifyBannerTitle')}</p>
        <p className="mt-0.5 text-amber-800 break-words">{t('auth.verifyBannerBody', { email: user.email })}</p>
        <ResendVerificationButton className="mt-1.5 inline-flex items-center font-semibold underline underline-offset-2" />
      </div>
    </div>
  )
}
