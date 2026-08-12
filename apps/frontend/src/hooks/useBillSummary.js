import { useTranslation } from 'react-i18next'
import { calculateSplits } from '../utils/math'
import { useCurrency } from './useCurrency'

export function useBillSummary(bill) {
  const { t } = useTranslation()
  const { fmt } = useCurrency()

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

  return {
    activeMembers,
    results,
    grandTotal,
    tipAmount,
    discountAmount,
    foodTotal,
    tipLabel,
    verificationSum,
    sumCheck,
    buildTextSummary,
  }
}
