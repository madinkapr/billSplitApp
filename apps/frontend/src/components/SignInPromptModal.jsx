import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'

// Shown when a guest hits the free daily limit on scan/voice (backend GUEST_LIMIT).
export default function SignInPromptModal({ onLogin, onRegister, onClose }) {
  const { t } = useTranslation()
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
          className="bg-white rounded-2xl w-full max-w-sm p-6 flex flex-col gap-4 shadow-xl relative"
        >
          <button onClick={onClose} className="absolute right-3 top-3 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
            <X size={16} />
          </button>
          <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center self-center">
            <Lock size={22} />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-bold text-gray-900">{t('auth.limitTitle')}</h2>
            <p className="text-sm text-gray-500 mt-1.5">{t('auth.limitBody')}</p>
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={onRegister} className="btn-primary w-full">
              {t('auth.registerButton')}
            </button>
            <button
              onClick={onLogin}
              className="w-full py-3 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              {t('auth.loginButton')}
            </button>
            <button onClick={onClose} className="w-full py-2 text-sm text-gray-400 hover:text-gray-600">
              {t('auth.later')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
