import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Copy, Check, RotateCcw, RefreshCw, ChevronDown, ChevronUp, HandCoins } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { calculateSplits, getItemShares } from '../utils/math'
import { useCurrency } from '../hooks/useCurrency'

function PersonCard({ result, index }) {
  const { t } = useTranslation()
  const { fmt } = useCurrency()
  const [open, setOpen] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="card overflow-hidden"
    >
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-3 px-4 py-4 text-left"
      >
        <div className="w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
          {result.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900">{result.name}{result.isMe ? t('common.you') : ''}</p>
          <p className="text-xs text-gray-400">{t('report.foodSubtotal', { amount: fmt(result.subtotal) })}</p>
        </div>
        <div className="text-right flex-shrink-0 flex items-center gap-2">
          <p className="text-xl font-bold text-indigo-600">{fmt(result.finalTotal)}</p>
          {open ? <ChevronUp size={14} className="text-gray-300" /> : <ChevronDown size={14} className="text-gray-300" />}
        </div>
      </button>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="border-t border-gray-50 px-4 py-3 bg-gray-50"
        >
          <p className="text-xs text-gray-400">
            {t('report.foodShareDetail', { subtotal: fmt(result.subtotal), total: fmt(result.finalTotal) })}
          </p>
        </motion.div>
      )}
    </motion.div>
  )
}

export default function Report({ bill, onReset, onSettleUp, onNewWithSameCrew }) {
  const { t } = useTranslation()
  const { fmt } = useCurrency()
  const [copied, setCopied] = useState(false)

  if (!bill) return null

  const allMembers = bill._adhocMembers || []
  const activeMembers = allMembers.filter((m) => bill.activeMembers.includes(m.id))

  const results = calculateSplits({
    items: bill.items || [],
    members: activeMembers,
    grandTotal: bill.grandTotal || 0,
  })

  const grandTotal = bill.grandTotal || 0
  const tipAmount = bill.tipAmount || 0
  const discountAmount = bill.discountAmount || 0
  const foodTotal = grandTotal - tipAmount + discountAmount
  const tipLabel = bill.tipMode === 'amount' ? t('report.tipAmountLabel') : t('report.tipPercentLabel', { percent: bill.tipPercent ?? 0 })
  const verificationSum = results.reduce((s, r) => s + r.finalTotal, 0)
  const sumCheck = Math.abs(verificationSum - grandTotal) < 0.015

  function buildTextSummary() {
    const lines = []
    lines.push(t('report.summaryHeader', { crew: `${bill.crewEmoji || ''} ${bill.crewName || t('report.lunch')}`.trim() }))
    lines.push('─'.repeat(32))
    lines.push(t('report.grandTotal', { amount: fmt(grandTotal) }))
    lines.push(`  ${tipLabel}: ${fmt(tipAmount)}`)
    lines.push(`  ${t('report.food')}: ${fmt(foodTotal)}`)
    lines.push('─'.repeat(32))
    results.forEach((r) => {
      lines.push(`${r.name}${r.isMe ? t('common.you') : ''}: ${fmt(r.finalTotal)}`)
    })
    lines.push('─'.repeat(32))
    lines.push(t('report.summaryVerification', { sum: fmt(verificationSum), total: fmt(grandTotal), check: sumCheck ? '✓' : '⚠️' }))
    lines.push(t('report.summarySplitBy'))
    return lines.join('\n')
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(buildTextSummary())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
      const ta = document.createElement('textarea')
      ta.value = buildTextSummary()
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="flex flex-col min-h-screen pb-8">
      {/* Header */}
      <div className="bg-indigo-600 px-5 pt-14 pb-6 text-white">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">{bill.crewEmoji || '🍽️'}</span>
          <h1 className="text-xl font-bold">{bill.crewName || t('report.billSplitFallback')}</h1>
        </div>
        <p className="text-indigo-200 text-sm">{t('report.grandTotal', { amount: fmt(grandTotal) })}</p>
      </div>

      <div className="px-5 pt-5 flex flex-col gap-4">
        {/* Bill summary bar */}
        <div className={`card p-4 grid divide-x divide-gray-100 text-center ${discountAmount > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">{t('report.food')}</p>
            <p className="font-bold text-gray-800 text-sm">{fmt(foodTotal)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">{tipLabel}</p>
            <p className="font-bold text-gray-800 text-sm">{fmt(tipAmount)}</p>
          </div>
          {discountAmount > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-0.5">{t('report.discount')}</p>
              <p className="font-bold text-red-500 text-sm">-{fmt(discountAmount)}</p>
            </div>
          )}
        </div>

        {/* Person cards */}
        <div className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('report.eachPersonOwes')}</h2>
          {results.map((r, i) => (
            <PersonCard key={r.id} result={r} index={i} />
          ))}
        </div>

        {/* Verification */}
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${sumCheck ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          <span>{sumCheck ? '✓' : '⚠️'}</span>
          <span>{sumCheck ? t('report.totalsVerified', { sum: fmt(verificationSum), total: fmt(grandTotal) }) : t('report.roundingDiff', { amount: fmt(Math.abs(verificationSum - grandTotal)) })}</span>
        </div>

        {/* Items breakdown */}
        {bill.items && bill.items.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('report.itemsHeader')}</h2>
            <div className="card divide-y divide-gray-50">
              {bill.items.map((item) => {
                const shares = getItemShares(item)
                const allEqual = Object.values(shares).every((c) => c === Object.values(shares)[0])
                const assignedLabels = activeMembers
                  .filter((m) => shares[m.id] > 0)
                  .map((m) => (allEqual ? m.name : `${m.name} ×${shares[m.id]}`))
                return (
                  <div key={item.id} className="flex flex-col px-4 py-3 gap-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-gray-800 flex-1 min-w-0 truncate">{item.name || t('report.itemFallback')}</p>
                      <div className="flex items-center gap-1.5 flex-shrink-0 text-sm font-semibold text-gray-700">
                        {item.quantity > 1 && item.unitPrice ? (
                          <>
                            <span className="text-gray-400 font-normal">{fmt(item.unitPrice)}</span>
                            <span className="text-gray-300">×</span>
                            <span className="text-gray-500">{item.quantity}</span>
                            <span className="text-gray-300">=</span>
                          </>
                        ) : null}
                        <span>{fmt(item.price)}</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 truncate">{assignedLabels.length > 0 ? assignedLabels.join(', ') : t('report.everyoneSplitEqually')}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={copyToClipboard}
          className={`btn-primary w-full text-base transition-colors ${copied ? 'bg-green-500 hover:bg-green-600' : ''}`}
        >
          {copied ? <><Check size={18} /> {t('report.copied')}</> : <><Copy size={18} /> {t('report.copySummary')}</>}
        </motion.button>

        {onSettleUp && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onSettleUp}
            className="btn-secondary w-full text-base"
          >
            <HandCoins size={18} /> {bill.settleBillId ? t('report.viewSettleStatus') : t('report.settleUp')}
          </motion.button>
        )}

        <div className="grid grid-cols-2 gap-3">
          {bill.crewId && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onNewWithSameCrew}
              className="btn-secondary flex-1"
            >
              <RefreshCw size={16} /> {t('report.sameCrew')}
            </motion.button>
          )}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onReset}
            className={`btn-secondary ${bill.crewId ? 'flex-1' : 'w-full'}`}
          >
            <RotateCcw size={16} /> {t('report.home')}
          </motion.button>
        </div>
      </div>
    </div>
  )
}
