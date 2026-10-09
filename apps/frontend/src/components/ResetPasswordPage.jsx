import React, { useState } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { AuthShell, PasswordInput, authErrorText } from './AuthPage'

// Opened from the emailed link (/reset-password?token=…). On success the backend signs
// the user in, so we go straight back to the app.
export default function ResetPasswordPage({ token, onDone, onForgotAgain }) {
  const { t } = useTranslation()
  const { resetPassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(token ? null : 'reset_invalid')

  const mismatch = confirm.length > 0 && password !== confirm
  const canSubmit = token && password.length > 0 && password === confirm && !busy

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await resetPassword(token, password)
      onDone()
    } catch (err) {
      setError(err.code || 'server_error')
    } finally {
      setBusy(false)
    }
  }

  if (error === 'reset_invalid') {
    return (
      <AuthShell title={t('auth.resetTitle')}>
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center">
            <AlertCircle size={22} />
          </div>
          <p className="text-sm text-gray-600">{t('auth.resetInvalid')}</p>
          <button onClick={onForgotAgain} className="btn-primary w-full mt-1">
            {t('auth.resetRequestNew')}
          </button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title={t('auth.resetTitle')} subtitle={t('auth.resetSubtitle')}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" placeholder={t('auth.passwordNew')} />
        <PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" placeholder={t('auth.passwordConfirm')} />
        {mismatch && <p className="text-sm text-red-600">{t('auth.passwordMismatch')}</p>}
        {error && <p className="text-sm text-red-600">{authErrorText(t, error)}</p>}
        <button type="submit" disabled={!canSubmit} className="btn-primary w-full disabled:opacity-50">
          {busy ? <Loader2 size={16} className="animate-spin" /> : t('auth.resetButton')}
        </button>
      </form>
    </AuthShell>
  )
}
