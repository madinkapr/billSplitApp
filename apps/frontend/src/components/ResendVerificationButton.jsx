import React, { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'

// "Send the confirmation email again" — used by every "confirm your email" notice. Turns
// into a short "sent" note once the backend accepts it.
export default function ResendVerificationButton({ className = '', label }) {
  const { t, i18n } = useTranslation()
  const { resendVerification } = useAuth()
  const [state, setState] = useState('idle') // idle | busy | sent | limited | error

  async function send() {
    setState('busy')
    try {
      await resendVerification(i18n.language)
      setState('sent')
    } catch (err) {
      setState(err.code === 'too_many_attempts' ? 'limited' : 'error')
    }
  }

  if (state === 'sent') return <span className={className}>{t('auth.verifySent')}</span>

  const text = {
    busy: <Loader2 size={14} className="animate-spin" />,
    limited: t('auth.errors.too_many_attempts'),
    error: t('auth.verifyResendFailed'),
  }[state]

  return (
    <button type="button" onClick={send} disabled={state === 'busy'} className={className}>
      {text || label || t('auth.verifyResend')}
    </button>
  )
}
