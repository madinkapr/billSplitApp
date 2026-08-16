import React, { useState } from 'react'
import { Copy, Check, ChevronDown, ChevronUp, Share2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getItemShares } from '../../utils/math'
import { copyText } from '../../utils/clipboard'
import { useCurrency } from '../../hooks/useCurrency'
import { useBillSummary } from '../../hooks/useBillSummary'
import { useSettleShare } from '../../hooks/useSettleShare'
import { useCalorieEstimate } from '../../hooks/useCalorieEstimate'
import SettleShareMenu from '../../components/SettleShareMenu'
import CalorieEstimate from '../../components/CalorieEstimate'

function PersonCard({ result }) {
  const { t } = useTranslation()
  const { fmt } = useCurrency()
  const [open, setOpen] = useState(false)

  return (
    <div className="bg-white border border-desktop-cardBorder rounded-2xl overflow-hidden">
      <button onClick={() => setOpen((p) => !p)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
        <span className="w-10 h-10 rounded-full bg-desktop-primary text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
          {result.name.charAt(0).toUpperCase()}
        </span>
        <span className="flex-1 min-w-0">
          <p className="font-semibold text-desktop-text truncate">{result.name}{result.isMe ? t('common.you') : ''}</p>
          <p className="text-xs text-desktop-textMuted3">{t('report.foodSubtotal', { amount: fmt(result.subtotal) })}</p>
        </span>
        <span className="flex items-center gap-2 flex-shrink-0">
          <span className="text-lg font-bold text-desktop-primary">{fmt(result.finalTotal)}</span>
          {open ? <ChevronUp size={14} className="text-desktop-textMuted3" /> : <ChevronDown size={14} className="text-desktop-textMuted3" />}
        </span>
      </button>
      {open && (
        <div className="border-t border-desktop-divider px-4 py-3 bg-desktop-content">
          <p className="text-xs text-desktop-textMuted3">
            {t('report.foodShareDetail', { subtotal: fmt(result.subtotal), total: fmt(result.finalTotal) })}
          </p>
        </div>
      )}
    </div>
  )
}

export default function DesktopSummary({ bill }) {
  const { t } = useTranslation()
  const { fmt } = useCurrency()
  const [copied, setCopied] = useState(false)

  const summary = useBillSummary(bill)
  const share = useSettleShare({ bill, results: summary?.results ?? [], tipAmount: summary?.tipAmount ?? 0, tipLabel: summary?.tipLabel ?? '' })
  const calorieEstimate = useCalorieEstimate({ bill, activeMembers: summary?.activeMembers ?? [] })

  if (!bill || !summary) return null

  const { activeMembers, results, grandTotal, tipAmount, discountAmount, foodTotal, tipLabel, verificationSum, sumCheck, buildTextSummary } = summary

  async function copyToClipboard() {
    await copyText(buildTextSummary())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      {/* Header band */}
      <div style={{ padding: '30px 44px', background: 'linear-gradient(135deg, #3e8ee8, #114f9e)' }} className="text-white">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">{bill.crewEmoji || '🍽️'}</span>
          <h1 className="text-2xl font-extrabold">{bill.crewName || t('report.billSplitFallback')}</h1>
        </div>
        <p className="text-white/80 text-sm">{t('report.grandTotal', { amount: fmt(grandTotal) })}</p>
      </div>

      <div style={{ padding: '32px 44px' }} className="flex gap-7 items-start">
        {/* Left column */}
        <div className="flex-1 flex flex-col gap-4" style={{ flex: 1.4 }}>
          <div className={`grid divide-x divide-desktop-divider bg-white border border-desktop-cardBorder rounded-2xl p-4 text-center ${discountAmount > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <div>
              <p className="text-xs text-desktop-textMuted3 mb-0.5">{t('report.food')}</p>
              <p className="font-bold text-desktop-text text-sm">{fmt(foodTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-desktop-textMuted3 mb-0.5">{tipLabel}</p>
              <p className="font-bold text-desktop-text text-sm">{fmt(tipAmount)}</p>
            </div>
            {discountAmount > 0 && (
              <div>
                <p className="text-xs text-desktop-textMuted3 mb-0.5">{t('report.discount')}</p>
                <p className="font-bold text-red-500 text-sm">-{fmt(discountAmount)}</p>
              </div>
            )}
          </div>

          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${sumCheck ? 'bg-desktop-successBg text-desktop-successText' : 'bg-red-50 text-red-700'}`}>
            <span>{sumCheck ? '✓' : '⚠️'}</span>
            <span>{sumCheck ? t('report.totalsVerified', { sum: fmt(verificationSum), total: fmt(grandTotal) }) : t('report.roundingDiff', { amount: fmt(Math.abs(verificationSum - grandTotal)) })}</span>
          </div>

          {bill.items && bill.items.length > 0 && (
            <div>
              <h2 className="text-[12px] font-bold uppercase tracking-wide text-desktop-textMuted3 mb-2">{t('report.itemsHeader')}</h2>
              <div className="bg-white border border-desktop-cardBorder rounded-2xl overflow-hidden">
                {bill.items.map((item, i) => {
                  const shares = getItemShares(item)
                  const allEqual = Object.values(shares).every((c) => c === Object.values(shares)[0])
                  const assignedLabels = activeMembers
                    .filter((m) => shares[m.id] > 0)
                    .map((m) => (allEqual ? m.name : `${m.name} ×${shares[m.id]}`))
                  return (
                    <div key={item.id} className={`flex flex-col px-4 py-3 gap-0.5 ${i > 0 ? 'border-t border-desktop-divider' : ''}`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-desktop-text flex-1 min-w-0 truncate">{item.name || t('report.itemFallback')}</p>
                        <div className="flex items-center gap-1.5 flex-shrink-0 text-sm font-semibold text-desktop-textSecondary">
                          {item.quantity > 1 && item.unitPrice ? (
                            <>
                              <span className="text-desktop-textMuted3 font-normal">{fmt(item.unitPrice)}</span>
                              <span className="text-desktop-textMuted3">×</span>
                              <span>{item.quantity}</span>
                              <span className="text-desktop-textMuted3">=</span>
                            </>
                          ) : null}
                          <span>{fmt(item.price)}</span>
                        </div>
                      </div>
                      <p className="text-xs text-desktop-textMuted3 truncate">{assignedLabels.length > 0 ? assignedLabels.join(', ') : t('report.everyoneSplitEqually')}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {bill.items && bill.items.length > 0 && (
            <CalorieEstimate estimate={calorieEstimate} theme="desktop" />
          )}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-3" style={{ width: 360, flexShrink: 0 }}>
          <h2 className="text-[12px] font-bold uppercase tracking-wide text-desktop-textMuted3">{t('report.eachPersonOwes')}</h2>
          {results.map((r) => (
            <PersonCard key={r.id} result={r} />
          ))}

          <div className="flex flex-col gap-2.5 mt-2">
            {share.canShare && (
              <div className="relative">
                <button
                  onClick={share.toggle}
                  className="w-full rounded-xl bg-white border border-desktop-cardBorder text-desktop-text font-bold text-sm py-3 flex items-center justify-center gap-2"
                >
                  <Share2 size={18} /> {t('settleUp.share')}
                </button>
                <SettleShareMenu share={share} />
              </div>
            )}

            <button
              onClick={copyToClipboard}
              className={`w-full rounded-xl text-white font-bold text-sm py-3 flex items-center justify-center gap-2 transition-colors ${copied ? 'bg-desktop-successText' : 'bg-desktop-primary'}`}
            >
              {copied ? <><Check size={18} /> {t('report.copied')}</> : <><Copy size={18} /> {t('report.copySummary')}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
