import React, { useEffect, useState } from 'react'
import { useBillApp } from './hooks/useBillApp'
import { useIsDesktop } from './hooks/useIsDesktop'
import MobileApp from './mobile/MobileApp'
import DesktopApp from './desktop/DesktopApp'
import AdminStatsPage from './admin/AdminStatsPage'
import { trackPageView } from './utils/analytics'
import AuthPage from './components/AuthPage'
import ResetPasswordPage from './components/ResetPasswordPage'
import VerifyEmailPage from './components/VerifyEmailPage'
import PrivacyPage from './legal/PrivacyPage'
import { canGoBackInApp } from './utils/navigate'
import SignInPromptModal from './components/SignInPromptModal'
import { AUTH_REQUIRED_EVENT, OPEN_LOGIN_EVENT } from './hooks/useAuth'

function getRouteFromLocation() {
  const path = window.location.pathname
  if (path.startsWith('/admin')) return 'admin'
  if (path.startsWith('/login')) return 'login'
  if (path.startsWith('/reset-password')) return 'reset'
  if (path.startsWith('/verify-email')) return 'verify'
  if (path.startsWith('/privacy')) return 'privacy'
  return 'app'
}

export default function App() {
  const billApp = useBillApp()
  const isDesktop = useIsDesktop()
  const [route, setRoute] = useState(getRouteFromLocation)
  const [authMode, setAuthMode] = useState(() => {
    const mode = new URLSearchParams(window.location.search).get('mode')
    return mode === 'register' || mode === 'forgot' ? mode : 'login'
  })
  // false, or why the dialog is open: 'limit' (guest: sign in) / 'verify' (confirm email)
  const [signInPrompt, setSignInPrompt] = useState(false)

  // Scan/voice hooks fire this when the free daily uses run out (GUEST_LIMIT / VERIFY_EMAIL).
  useEffect(() => {
    const onAuthRequired = (e) => setSignInPrompt(e.detail?.reason || 'limit')
    const onOpenLogin = (e) => goToLogin(e.detail?.mode)
    window.addEventListener(AUTH_REQUIRED_EVENT, onAuthRequired)
    window.addEventListener(OPEN_LOGIN_EVENT, onOpenLogin)
    return () => {
      window.removeEventListener(AUTH_REQUIRED_EVENT, onAuthRequired)
      window.removeEventListener(OPEN_LOGIN_EVENT, onOpenLogin)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function onPopState() {
      setRoute(getRouteFromLocation())
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    // Track once per real page load, not every time an admin bounces
    // between the stats dashboard and the app within the same session.
    if (getRouteFromLocation() === 'app') trackPageView()
  }, [])

  function goToStats() {
    window.history.pushState(null, '', '/admin/stats')
    setRoute('admin')
  }

  function goToLogin(mode = 'login') {
    setSignInPrompt(false)
    setAuthMode(mode)
    window.history.pushState(null, '', mode === 'login' ? '/login' : `/login?mode=${mode}`)
    setRoute('login')
  }

  function goToApp(screen) {
    window.history.pushState(null, '', '/')
    setRoute('app')
    if (screen) billApp.navigate(screen)
  }

  if (route === 'admin') return <AdminStatsPage onBack={goToApp} />
  // The bill in progress lives in useBillApp state, so going to /login and back keeps it.
  if (route === 'privacy') return <PrivacyPage onBack={() => (canGoBackInApp() ? window.history.back() : goToApp())} />
  if (route === 'reset') {
    const token = new URLSearchParams(window.location.search).get('token') || ''
    return <ResetPasswordPage token={token} onDone={() => goToApp()} onForgotAgain={() => goToLogin('forgot')} />
  }
  if (route === 'verify') {
    const token = new URLSearchParams(window.location.search).get('token') || ''
    return <VerifyEmailPage token={token} onDone={() => goToApp()} />
  }
  if (route === 'login') return <AuthPage key={authMode} initialMode={authMode} onDone={() => goToApp()} onBack={() => goToApp()} />

  return (
    <>
      {isDesktop ? (
        <DesktopApp {...billApp} onOpenStats={goToStats} onOpenLogin={goToLogin} />
      ) : (
        <MobileApp {...billApp} onOpenStats={goToStats} onOpenLogin={goToLogin} />
      )}
      {signInPrompt && (
        <SignInPromptModal
          reason={signInPrompt}
          onLogin={() => goToLogin('login')}
          onRegister={() => goToLogin('register')}
          onClose={() => setSignInPrompt(false)}
        />
      )}
    </>
  )
}
