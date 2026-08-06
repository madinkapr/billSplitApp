import React from 'react'
import { Plus, Users, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCurrency } from '../../hooks/useCurrency'

export default function DesktopHome({ crews, recentBills, onStartNewBill, onSelectCrew, onManageCrews, onViewBill, onViewAllBills }) {
  const { t } = useTranslation()
  const { fmt } = useCurrency()
  const recentCrews = crews.slice(0, 4)

  return (
    <div className="flex flex-col gap-[30px]" style={{ padding: '40px 44px' }}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-[14px] flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #8b7bff, #5a4bd6)' }}
        >
          <span className="text-2xl leading-none">💸</span>
        </div>
        <div>
          <h1 className="text-[24px] font-extrabold text-desktop-text leading-tight">{t('home.title')}</h1>
          <p className="text-sm text-desktop-textMuted">{t('home.tagline')}</p>
        </div>
      </div>

      {/* Primary actions */}
      <div className="flex gap-5">
        <button
          onClick={onStartNewBill}
          className="text-left rounded-[18px] text-white flex items-center gap-4"
          style={{
            flex: 1.3,
            padding: '26px 28px',
            background: 'linear-gradient(135deg, #8b7bff, #5a4bd6)',
            boxShadow: '0 10px 20px -6px rgba(81,64,214,.48)',
          }}
        >
          <span className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <Plus size={22} />
          </span>
          <span>
            <p className="font-bold text-[17px]">{t('home.newBill')}</p>
            <p className="text-[13px] text-white/80 mt-0.5">{t('home.tagline')}</p>
          </span>
        </button>

        <button
          onClick={onManageCrews}
          className="flex-1 text-left rounded-[18px] bg-white border border-desktop-cardBorder flex items-center gap-4"
          style={{ padding: '26px 28px' }}
        >
          <span className="w-11 h-11 rounded-full bg-desktop-tileHome flex items-center justify-center flex-shrink-0">
            <Users size={20} className="text-desktop-primary" />
          </span>
          <span>
            <p className="font-bold text-[17px] text-desktop-text">{t('home.myCrews')}</p>
            <p className="text-[13px] text-desktop-textMuted mt-0.5">{t('home.quickStart')}</p>
          </span>
        </button>
      </div>

      {/* Quick Start */}
      {recentCrews.length > 0 && (
        <div>
          <h2 className="text-[12px] font-bold uppercase tracking-wide text-desktop-textMuted3 mb-3">{t('home.quickStart')}</h2>
          <div className="flex flex-col gap-2.5">
            {recentCrews.map((crew) => (
              <button
                key={crew.id}
                onClick={() => onSelectCrew(crew)}
                className="w-full flex items-center gap-3.5 bg-white border border-desktop-cardBorder rounded-2xl text-left hover:border-desktop-primary/40 transition-colors"
                style={{ padding: '16px 20px' }}
              >
                <span className="w-[46px] h-[46px] rounded-xl bg-desktop-tileHome flex items-center justify-center text-2xl flex-shrink-0">
                  {crew.emoji}
                </span>
                <span className="flex-1 min-w-0">
                  <p className="font-bold text-[15px] text-desktop-text truncate">{crew.name}</p>
                  <p className="text-[12.5px] text-desktop-textMuted3">{t('home.memberCount', { count: crew.members.length })}</p>
                </span>
                <ChevronRight size={18} className="text-desktop-textMuted3 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recent Bills */}
      {recentBills.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[12px] font-bold uppercase tracking-wide text-desktop-textMuted3">{t('home.recentBills')}</h2>
            {recentBills.length > 3 && (
              <button onClick={onViewAllBills} className="text-[13px] font-bold text-desktop-primary">
                {t('home.viewAll')}
              </button>
            )}
          </div>
          <div className="bg-white rounded-2xl border border-desktop-cardBorder overflow-hidden">
            {recentBills.slice(0, 5).map((bill, i) => (
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
                  </p>
                </span>
                <ChevronRight size={18} className="text-desktop-textMuted3 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {crews.length === 0 && recentBills.length === 0 && (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🍕</div>
          <h3 className="font-semibold text-desktop-text mb-1">{t('home.emptyTitle')}</h3>
          <p className="text-sm text-desktop-textMuted3">{t('home.emptyBody')}</p>
        </div>
      )}
    </div>
  )
}
