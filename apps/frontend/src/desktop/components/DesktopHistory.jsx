import React from 'react'
import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCurrency } from '../../hooks/useCurrency'

function formatBillDate(createdAt, language) {
  if (!createdAt) return null
  return new Date(createdAt).toLocaleDateString(language, { day: 'numeric', month: 'short' })
}

export default function DesktopHistory({ recentBills, onViewBill }) {
  const { t, i18n } = useTranslation()
  const { fmt } = useCurrency()

  return (
    <div style={{ padding: '40px 44px' }}>
      <div className="mb-7">
        <h1 className="text-[24px] font-extrabold text-desktop-text">{t('billHistory.title')}</h1>
        <p className="text-sm text-desktop-textMuted mt-1">{t('billHistory.subtitleCount', { count: recentBills.length })}</p>
      </div>

      {recentBills.length === 0 ? (
        <div className="text-center py-16 bg-white border border-desktop-cardBorder rounded-2xl">
          <div className="text-5xl mb-4">🧾</div>
          <h3 className="font-semibold text-desktop-text mb-1">{t('billHistory.noBillsYet')}</h3>
          <p className="text-sm text-desktop-textMuted3">{t('billHistory.noBillsBody')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-desktop-cardBorder overflow-hidden">
          {recentBills.map((bill, i) => (
            <button
              key={bill.id}
              onClick={() => onViewBill(bill)}
              className={`w-full flex items-center gap-3.5 px-5 py-3.5 text-left hover:bg-desktop-content/60 transition-colors ${
                i > 0 ? 'border-t border-desktop-divider' : ''
              }`}
            >
              <span className="w-10 h-10 rounded-xl bg-desktop-content flex items-center justify-center text-xl flex-shrink-0">
                {bill.crewEmoji || '🍽️'}
              </span>
              <span className="flex-1 min-w-0">
                <p className="font-semibold text-[14px] text-desktop-text truncate">{bill.crewName || t('home.quickSplit')}</p>
                <p className="text-[12.5px] text-desktop-textMuted3">
                  {t('billHistory.peopleCount', { count: bill.activeMembers?.length || 0 })} · {fmt(bill.grandTotal || 0)}
                  {formatBillDate(bill.createdAt, i18n.language) && ` · ${formatBillDate(bill.createdAt, i18n.language)}`}
                </p>
              </span>
              <ChevronRight size={18} className="text-desktop-textMuted3 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
