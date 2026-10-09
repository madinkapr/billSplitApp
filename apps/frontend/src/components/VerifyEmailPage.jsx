import React, { useEffect, useRef, useState } from 'react'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { AuthShell, authErrorText } from './AuthPage'
import ResendVerificationButton from './ResendVerificationButton'

// Opened from the "confirm your email" link (/verify-email?token=…). It only marks the
// email as confirmed — nobody is signed in by it, since the link may be opened on another
// device than the one the account is used on.
export default function VerifyEmailPage({ token, onDone }) {
  const { t } = useTranslation()
  const { user, verifyEmail } = useAuth()
  const [state, setState] = useState(token ? 'checking' : 'invalid') // checking | done | invalid | error
  const started = useRef(false)

  useEffect(() => {
    // Once only — StrictMode runs effects twice in dev, and the token is single-use.
    if (!token || started.current) return
    started.current = true
    verifyEmail(token)
      .then(() => setState('done'))
      .catch((err) => setState(err.code === 'verify_invalid' ? 'invalid' : 'error'))
  }, [token, verifyEmail])

  // An old link clicked after the email was already confirmed some other way.
  const shown = state === 'invalid' && user?.emailVerified ? 'done' : state

  return (
    <AuthShell title={t('auth.verifyPageTitle')}>
      <div className="flex flex-col items-center gap-3 text-center">
        {shown === 'checking' && (
          <>
            <Loader2 size={28} className="animate-spin text-indigo-500" />
            <p className="text-sm text-gray-600">{t('auth.verifyChecking')}</p>
          </>
        )}

        {shown === 'done' && (
          <>
            <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
              <CheckCircle2 size={24} />
            </div>
            <p className="text-sm text-gray-600">{t('auth.verifyDone')}</p>
            <button onClick={onDone} className="btn-primary w-full mt-1">
              {t('auth.verifyContinue')}
            </button>
          </>
        )}

        {(shown === 'invalid' || shown === 'error') && (
          <>
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center">
              <AlertCircle size={22} />
            </div>
            <p className="text-sm text-gray-600">{shown === 'invalid' ? t('auth.verifyInvalid') : authErrorText(t, 'server_error')}</p>
            {shown === 'invalid' && user && !user.emailVerified && (
              <ResendVerificationButton className="btn-primary w-full mt-1 flex items-center justify-center" label={t('auth.verifyResendNew')} />
            )}
            {shown === 'invalid' && !user && <p className="text-xs text-gray-400">{t('auth.verifyLoginToResend')}</p>}
            <button onClick={onDone} className="w-full py-3 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              {t('auth.verifyContinue')}
            </button>
          </>
        )}
      </div>
    </AuthShell>
  )
}
