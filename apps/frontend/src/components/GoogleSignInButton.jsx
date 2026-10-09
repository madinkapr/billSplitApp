import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const GSI_SRC = 'https://accounts.google.com/gsi/client'
let gsiPromise = null

function loadGsi() {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (!gsiPromise) {
    gsiPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = GSI_SRC
      s.async = true
      s.onload = resolve
      s.onerror = () => {
        gsiPromise = null
        reject(new Error('gsi_load_failed'))
      }
      document.head.appendChild(s)
    })
  }
  return gsiPromise
}

// Google blocks its sign-in inside in-app browsers (Telegram, Instagram, Android
// WebViews: "disallowed_useragent"), and many visitors open schet.uz from a Telegram
// link — tell them to open the page in a real browser instead of failing silently.
function isInAppBrowser() {
  return /Telegram|FBAN|FBAV|Instagram|; wv\)/i.test(navigator.userAgent || '')
}

// Google's official "Sign in with Google" button (Google Identity Services). On success
// it hands us a signed ID token, which the backend verifies (routes/auth.js /google).
export default function GoogleSignInButton({ clientId, onCredential, onError }) {
  const { i18n, t } = useTranslation()
  const containerRef = useRef(null)
  const [width, setWidth] = useState(0)
  const inApp = isInAppBrowser()

  useEffect(() => {
    if (containerRef.current) setWidth(Math.min(400, Math.floor(containerRef.current.offsetWidth)))
  }, [])

  useEffect(() => {
    if (!clientId || !width || inApp) return
    let cancelled = false
    loadGsi()
      .then(() => {
        if (cancelled || !containerRef.current) return
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (resp) => onCredential(resp.credential),
          ux_mode: 'popup',
        })
        containerRef.current.innerHTML = ''
        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          logo_alignment: 'center',
          width,
          locale: i18n.language,
        })
      })
      .catch(() => onError?.('gsi_load_failed'))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, width, i18n.language])

  if (inApp) {
    return (
      <p className="text-xs text-center text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
        {t('auth.googleInAppHint')}
      </p>
    )
  }

  return <div ref={containerRef} className="w-full flex justify-center min-h-[44px]" />
}
