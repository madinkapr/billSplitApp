import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'

// Who is signed in, shared app-wide. The session itself is an httpOnly cookie set by
// the backend (routes/auth.js) — the page never sees the token, it only asks /me.
const AuthContext = createContext(null)

async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  let json = null
  try {
    json = await res.json()
  } catch {
    // 204 / non-JSON
  }
  if (!res.ok) throw Object.assign(new Error(json?.error || 'server_error'), { code: json?.error || 'server_error' })
  return json
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [googleClientId, setGoogleClientId] = useState(null)
  // Guests only: today's free scan/voice uses, e.g. { scan: { used: 1, limit: 3 }, voice: {...} }.
  const [usage, setUsage] = useState(null)

  const refreshUsage = useCallback(() => {
    fetch('/api/auth/usage')
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => setUsage(u && u.guest ? u : null))
      .catch(() => {})
  }, [])

  // Re-read after login/logout and whenever a scan/voice call succeeds.
  useEffect(() => {
    if (loading) return
    refreshUsage()
  }, [user, loading, refreshUsage])

  useEffect(() => {
    window.addEventListener(USAGE_CHANGED_EVENT, refreshUsage)
    return () => window.removeEventListener(USAGE_CHANGED_EVENT, refreshUsage)
  }, [refreshUsage])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/auth/me').then((r) => (r.ok ? r.json() : { user: null })),
      fetch('/api/auth/config').then((r) => (r.ok ? r.json() : {})),
    ])
      .then(([me, config]) => {
        if (cancelled) return
        setUser(me.user || null)
        setGoogleClientId(config.googleClientId || null)
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email, password) => {
    const { user } = await post('/api/auth/login', { email, password })
    setUser(user)
    return user
  }, [])

  // `lang` picks the language of the "confirm your email" message sent right away.
  const register = useCallback(async (name, email, password, lang) => {
    const { user } = await post('/api/auth/register', { name, email, password, lang })
    setUser(user)
    return user
  }, [])

  const refreshUser = useCallback(async () => {
    const r = await fetch('/api/auth/me')
    if (r.ok) setUser((await r.json()).user || null)
  }, [])

  const resendVerification = useCallback(async (lang) => {
    await post('/api/auth/verify-email/resend', { lang })
  }, [])

  // From the emailed link; refreshes the session user in case it's the same account.
  const verifyEmail = useCallback(
    async (token) => {
      await post('/api/auth/verify-email', { token })
      await refreshUser().catch(() => {})
    },
    [refreshUser]
  )

  // The link is often opened on another device (phone mail app): re-check when the user
  // comes back to this tab, so the "confirm your email" notices go away by themselves.
  useEffect(() => {
    if (!user || user.emailVerified) return
    const onFocus = () => document.visibilityState === 'visible' && refreshUser().catch(() => {})
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [user, refreshUser])

  const loginWithGoogle = useCallback(async (credential) => {
    const { user } = await post('/api/auth/google', { credential })
    setUser(user)
    return user
  }, [])

  // Always resolves the same way whether or not the email has an account.
  const forgotPassword = useCallback(async (email, lang) => {
    await post('/api/auth/forgot', { email, lang })
  }, [])

  const resetPassword = useCallback(async (token, password) => {
    const { user } = await post('/api/auth/reset', { token, password })
    setUser(user)
    return user
  }, [])

  const logout = useCallback(async () => {
    await post('/api/auth/logout').catch(() => {})
    setUser(null)
    window.google?.accounts?.id?.disableAutoSelect?.()
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        googleClientId,
        usage,
        refreshUsage,
        login,
        register,
        loginWithGoogle,
        forgotPassword,
        resetPassword,
        resendVerification,
        verifyEmail,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

// Scan/voice hooks call this when the backend answers GUEST_LIMIT (reason 'limit') or
// VERIFY_EMAIL (reason 'verify'); App shows the "sign in" or "confirm your email" dialog.
// An event keeps those hooks free of UI wiring.
export const AUTH_REQUIRED_EVENT = 'schet:auth-required'

export function requestSignIn(reason) {
  window.dispatchEvent(new CustomEvent(AUTH_REQUIRED_EVENT, { detail: { reason } }))
}

// Opens the /login page from anywhere (App owns the routing).
export const OPEN_LOGIN_EVENT = 'schet:open-login'

export function openLogin(mode = 'login') {
  window.dispatchEvent(new CustomEvent(OPEN_LOGIN_EVENT, { detail: { mode } }))
}

// Fired after a successful scan/voice call so the free-uses counter updates.
export const USAGE_CHANGED_EVENT = 'schet:usage-changed'

export function notifyUsageChanged() {
  window.dispatchEvent(new CustomEvent(USAGE_CHANGED_EVENT))
}
