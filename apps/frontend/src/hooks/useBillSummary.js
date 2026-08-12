import { useTranslation } from 'react-i18next'
import { calculateSplits, getItemShares } from '../utils/math'
import { getUnitPrice } from '../utils/itemizerState'
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

  function personalItemsForMember(memberId) {
    return (bill.items || [])
      .filter((item) => getItemShares(item)[memberId] > 0)
      .map((item) => {
        const count = getItemShares(item)[memberId]
        const amount = getUnitPrice(item) * count
        const label = count > 1 ? `${item.name} ×${count}` : item.name
        return `${label} - ${fmt(amount)}`
      })
  }

  function sharedItems() {
    return (bill.items || [])
      .filter((item) => item.everyone === true && Object.keys(getItemShares(item)).length === 0)
      .map((item) => `${item.name} - ${fmt(item.price / Math.max(activeMembers.length, 1))}`)
  }

  function buildTextSummary() {
    const lines = []
    lines.push(t('report.summaryHeader', { crew: `${bill.crewEmoji || ''} ${bill.crewName || t('report.lunch')}`.trim() }))
    lines.push('─'.repeat(32))
    const shared = sharedItems()
    results.forEach((r, i) => {
      const personal = personalItemsForMember(r.id)
      if (i > 0) lines.push('')
      lines.push(`${r.name}${r.isMe ? t('common.you') : ''}: ${fmt(r.finalTotal)}`)
      if (personal.length > 0) {
        const dishesLabel = r.isMe ? t('report.ateLabel') : t('report.dishesLabel')
        lines.push(`${dishesLabel}:`)
        personal.forEach((name) => lines.push(`- ${name}`))
      }
      if (shared.length > 0) {
        lines.push(`${t('report.everyoneSplitEqually')}:`)
        shared.forEach((name) => lines.push(`- ${name}`))
      }
    })
    return lines.join('\n').trim()
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
