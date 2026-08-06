import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { PlusCircle, Users, Receipt, ChevronRight, Clock, Globe, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useCurrency } from '../hooks/useCurrency'

const LANGUAGES = [
  { code: 'uz', label: "O'zbek" },
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
]

export default function HomeScreen({ crews, recentBills, onStartNewBill, onSelectCrew, onManageCrews, onViewBill, onViewAllBills }) {
  const { t, i18n } = useTranslation()
  const { currency, setCurrency, fmt, CURRENCIES } = useCurrency()
  const [language, setLanguage] = useLocalStorage('tabup_language', 'uz')
  const [langOpen, setLangOpen] = useState(false)
  const [currencyOpen, setCurrencyOpen] = useState(false)
  const recentCrews = crews.slice(0, 4)

  useEffect(() => {
    i18n.changeLanguage(language)
  }, [language, i18n])

  return (
    <div className="flex flex-col min-h-screen pb-8">
      {/* Header */}
      <div className="bg-indigo-600 px-5 pt-14 pb-8 text-white relative">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl">💸</span>
            <h1 className="text-2xl font-bold tracking-tight">{t('home.title')}</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setCurrencyOpen((p) => !p)}
                className="h-9 px-3 flex items-center justify-center rounded-full bg-white/15 active:bg-white/25 transition-colors text-sm font-semibold"
                aria-label={t('currency.picker')}
              >
                {CURRENCIES[currency].symbol}
              </button>
              {currencyOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setCurrencyOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute right-0 top-11 bg-white rounded-xl shadow-lg border border-gray-100 py-1 w-40 z-20 text-gray-800"
                  >
                    {Object.values(CURRENCIES).map((c) => (
                      <button
                        key={c.code}
                        onClick={() => { setCurrency(c.code); setCurrencyOpen(false) }}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-gray-50 active:bg-gray-100 transition-colors"
                      >
                        <span className={currency === c.code ? 'font-semibold text-indigo-600' : ''}>
                          {t(`currency.${c.code.toLowerCase()}`)} ({c.symbol})
                        </span>
                        {currency === c.code && <Check size={14} className="text-indigo-600" />}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setLangOpen((p) => !p)}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-white/15 active:bg-white/25 transition-colors"
                aria-label={t('language.picker')}
              >
                <Globe size={18} />
              </button>
              {langOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setLangOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute right-0 top-11 bg-white rounded-xl shadow-lg border border-gray-100 py-1 w-36 z-20 text-gray-800"
                  >
                    {LANGUAGES.map((l) => (
                      <button
                        key={l.code}
                        onClick={() => { setLanguage(l.code); setLangOpen(false) }}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-gray-50 active:bg-gray-100 transition-colors"
                      >
                        <span className={language === l.code ? 'font-semibold text-indigo-600' : ''}>{l.label}</span>
                        {language === l.code && <Check size={14} className="text-indigo-600" />}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </div>
          </div>
        </div>
        <p className="text-indigo-200 text-sm">{t('home.tagline')}</p>
      </div>

      <div className="flex flex-col gap-4 px-5 pt-6">
        {/* Primary actions */}
        <div className="grid grid-cols-2 gap-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onStartNewBill}
            className="btn-primary flex-col py-5 rounded-2xl shadow-md shadow-indigo-200"
          >
            <PlusCircle size={24} />
            <span className="text-sm mt-1">{t('home.newBill')}</span>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onManageCrews}
            className="bg-white border border-gray-200 text-gray-700 rounded-2xl font-semibold py-5 touch-btn flex flex-col items-center justify-center gap-1 active:bg-gray-50 transition-colors shadow-sm"
          >
            <Users size={24} className="text-indigo-500" />
            <span className="text-sm mt-1">{t('home.myCrews')}</span>
          </motion.button>
        </div>

        {/* Recent Crews */}
        {recentCrews.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{t('home.quickStart')}</h2>
            <div className="card divide-y divide-gray-50">
              {recentCrews.map((crew, i) => (
                <motion.button
                  key={crew.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onSelectCrew(crew)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-gray-50 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
                >
                  <span className="text-2xl w-10 h-10 flex items-center justify-center bg-indigo-50 rounded-xl">{crew.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{crew.name}</p>
                    <p className="text-xs text-gray-400">{t('home.memberCount', { count: crew.members.length })}</p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Recent Bills */}
        {recentBills.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('home.recentBills')}</h2>
              {recentBills.length > 3 && (
                <button
                  onClick={onViewAllBills}
                  className="text-xs font-semibold text-indigo-500 active:text-indigo-600"
                >
                  {t('home.viewAll')}
                </button>
              )}
            </div>
            <div className="card divide-y divide-gray-50">
              {recentBills.slice(0, 3).map((bill) => (
                <motion.button
                  key={bill.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onViewBill(bill)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-gray-50 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
                >
                  <div className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-xl">
                    <span className="text-xl">{bill.crewEmoji || '🍽️'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{bill.crewName || t('home.quickSplit')}</p>
                    <p className="text-xs text-gray-400">{t('billHistory.peopleCount', { count: bill.activeMembers?.length || 0 })} · {fmt(bill.grandTotal || 0)}</p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {crews.length === 0 && recentBills.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <div className="text-5xl mb-4">🍕</div>
            <h3 className="font-semibold text-gray-700 mb-1">{t('home.emptyTitle')}</h3>
            <p className="text-sm text-gray-400">{t('home.emptyBody')}</p>
          </motion.div>
        )}
      </div>
    </div>
  )
}
