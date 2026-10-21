import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Lock, MailWarning } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import ResendVerificationButton from './ResendVerificationButton'

// Shown when the free daily limit on scan/voice runs out: a guest is asked to sign in
// (backend GUEST_LIMIT); a signed-in account with an unconfirmed email is asked to
// confirm it instead (VERIFY_EMAIL, reason 'verify').
export default function SignInPromptModal({ reason = 'limit', onLogin, onRegister, onClose }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const verify = reason === 'verify'
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-surface rounded-2xl w-full max-w-sm p-6 flex flex-col gap-4 shadow-xl relative"
        >
          <button onClick={onClose} aria-label={t('common.close')} className="absolute right-2 top-2 w-11 h-11 flex items-center justify-center rounded-full hover:bg-surface-2">
            <X size={16} />
          </button>
          <div className="w-12 h-12 rounded-full bg-accent-tint text-link flex items-center justify-center self-center">
            {verify ? <MailWarning size={22} /> : <Lock size={22} />}
          </div>
          <div className="text-center">
            <h2 className="text-lg font-bold text-ink">{t(verify ? 'auth.verifyLimitTitle' : 'auth.limitTitle')}</h2>
            <p className="text-sm text-ink-2 mt-1.5 break-words">
              {verify ? t('auth.verifyLimitBody', { email: user?.email || '' }) : t('auth.limitBody')}
            </p>
          </div>
          {verify ? (
            <div className="flex flex-col gap-2">
              <ResendVerificationButton className="btn-primary w-full flex items-center justify-center" />
              <button onClick={onClose} className="w-full py-2 text-sm text-ink-2 hover:text-ink">
                {t('auth.later')}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <button onClick={onRegister} className="btn-primary w-full">
                {t('auth.registerButton')}
              </button>
              <button
                onClick={onLogin}
                className="w-full py-3 rounded-xl border-2 border-line text-sm font-semibold text-ink hover:bg-surface-2"
              >
                {t('auth.loginButton')}
              </button>
              <button onClick={onClose} className="w-full py-2 text-sm text-ink-2 hover:text-ink">
                {t('auth.later')}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
