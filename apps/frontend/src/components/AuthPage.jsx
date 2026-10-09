import React, { useState } from 'react'
import { ArrowLeft, Eye, EyeOff, Loader2, MailCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import GoogleSignInButton from './GoogleSignInButton'
import { inAppLinkClick } from '../utils/navigate'

const KNOWN_ERRORS = [
  'invalid_credentials',
  'email_taken',
  'use_google',
  'invalid_email',
  'weak_password',
  'name_required',
  'too_many_attempts',
  'google_invalid',
  'google_not_configured',
  'gsi_load_failed',
]

export function authErrorText(t, code) {
  return code ? t(`auth.errors.${KNOWN_ERRORS.includes(code) ? code : 'server_error'}`) : null
}

function PasswordInput({ value, onChange, placeholder, autoComplete }) {
  const { t } = useTranslation()
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-field pr-10"
      />
      <button
        type="button"
        onClick={() => setShow((p) => !p)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        tabIndex={-1}
        aria-label={t('auth.togglePassword')}
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  )
}

// Shared page frame for the auth screens (sign in / sign up / forgot / reset).
export function AuthShell({ title, subtitle, onBack, children, footer }) {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        {onBack && (
          <button onClick={onBack} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700">
            <ArrowLeft size={16} />
            {t('auth.back')}
          </button>
        )}
        <div className="card p-6 flex flex-col gap-5">
          <div className="flex flex-col items-center gap-3 text-center">
            <img src="/logo-schet.png" alt="SCHET.uz" className="h-10 w-auto object-contain" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">{title}</h1>
              {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
            </div>
          </div>
          {children}
        </div>
        {footer}
      </div>
    </div>
  )
}

export { PasswordInput }

// Sign in / sign up — email + password form, "Continue with Google" underneath — plus
// the "forgot password" step. Used full-screen on both mobile and desktop (route /login).
export default function AuthPage({ initialMode = 'login', onDone, onBack }) {
  const { t, i18n } = useTranslation()
  const { login, register, loginWithGoogle, forgotPassword, googleClientId } = useAuth()
  const [mode, setMode] = useState(initialMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [resetSent, setResetSent] = useState(false)

  const isRegister = mode === 'register'
  const isForgot = mode === 'forgot'

  async function run(action, after = onDone) {
    setBusy(true)
    setError(null)
    try {
      await action()
      after()
    } catch (err) {
      setError(err.code || err.message || 'server_error')
    } finally {
      setBusy(false)
    }
  }

  function switchTo(next) {
    setMode(next)
    setError(null)
    setResetSent(false)
  }

  function submit(e) {
    e.preventDefault()
    if (isForgot) {
      run(() => forgotPassword(email.trim(), i18n.language), () => setResetSent(true))
      return
    }
    run(() => (isRegister ? register(name.trim(), email.trim(), password, i18n.language) : login(email.trim(), password)))
  }

  const canSubmit = email.trim() && (isForgot || password) && (!isRegister || name.trim()) && !busy
  const errorText = authErrorText(t, error)

  if (isForgot) {
    return (
      <AuthShell
        title={t('auth.forgotTitle')}
        subtitle={resetSent ? null : t('auth.forgotSubtitle')}
        onBack={() => switchTo('login')}
      >
        {resetSent ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
              <MailCheck size={22} />
            </div>
            <p className="text-sm text-gray-600">{t('auth.forgotSent', { email: email.trim() })}</p>
            <button onClick={() => switchTo('login')} className="btn-primary w-full mt-1">
              {t('auth.backToLogin')}
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <input
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.email')}
              className="input-field"
            />
            {errorText && <p className="text-sm text-red-600">{errorText}</p>}
            <button type="submit" disabled={!canSubmit} className="btn-primary w-full disabled:opacity-50">
              {busy ? <Loader2 size={16} className="animate-spin" /> : t('auth.forgotButton')}
            </button>
          </form>
        )}
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title={isRegister ? t('auth.registerTitle') : t('auth.loginTitle')}
      subtitle={isRegister ? t('auth.registerSubtitle') : t('auth.loginSubtitle')}
      onBack={onBack}
      footer={
        <button onClick={onBack} className="mt-4 w-full text-center text-sm text-gray-500 hover:text-gray-700">
          {t('auth.continueAsGuest')}
        </button>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-3">
        {isRegister && (
          <input
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('auth.name')}
            maxLength={50}
            className="input-field"
          />
        )}
        <input
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('auth.email')}
          className="input-field"
        />
        <PasswordInput
          value={password}
          onChange={setPassword}
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          placeholder={isRegister ? t('auth.passwordNew') : t('auth.password')}
        />
        {!isRegister && (
          <button type="button" onClick={() => switchTo('forgot')} className="self-end -mt-1 text-xs font-semibold text-indigo-600 hover:underline">
            {t('auth.forgotLink')}
          </button>
        )}

        {errorText && <p className="text-sm text-red-600">{errorText}</p>}

        <button type="submit" disabled={!canSubmit} className="btn-primary w-full disabled:opacity-50">
          {busy ? <Loader2 size={16} className="animate-spin" /> : isRegister ? t('auth.registerButton') : t('auth.loginButton')}
        </button>
        {isRegister && (
          <p className="text-xs text-center text-gray-400">
            {t('auth.agreePrefix')}{' '}
            <a href="/privacy" onClick={inAppLinkClick('/privacy')} className="underline hover:text-gray-600">
              {t('legal.privacy')}
            </a>
            {t('auth.agreeSuffix')}
          </p>
        )}
      </form>

      <p className="text-sm text-center text-gray-500">
        {isRegister ? t('auth.haveAccount') : t('auth.noAccount')}{' '}
        <button onClick={() => switchTo(isRegister ? 'login' : 'register')} className="font-semibold text-indigo-600 hover:underline">
          {isRegister ? t('auth.loginLink') : t('auth.registerLink')}
        </button>
      </p>

      {googleClientId && (
        <>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <div className="flex-1 h-px bg-gray-200" />
            {t('auth.or')}
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          <GoogleSignInButton
            clientId={googleClientId}
            onCredential={(credential) => run(() => loginWithGoogle(credential))}
            onError={(code) => setError(code)}
          />
        </>
      )}
    </AuthShell>
  )
}
