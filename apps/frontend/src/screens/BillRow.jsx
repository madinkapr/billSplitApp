import React from 'react'
import { useTranslation } from 'react-i18next'
import { useCurrency } from '../hooks/useCurrency'
import { useSettleStatus, paidSummary } from '../hooks/useSettleStatus'
import { formatShortDate } from '../utils/formatDate'
import Avatar from '../ui/Avatar'
import StatusPill from '../ui/StatusPill'
import Skeleton from '../ui/Skeleton'

// "Not sent" / "2 of 4 paid" / "All paid" for a saved bill.
export function BillStatusPill({ billId }) {
  const { t } = useTranslation()
  const { shared, loading, data } = useSettleStatus(billId)
  if (loading) return <Skeleton className="h-6 w-20 !rounded-full" />
  if (!shared || !data) return <StatusPill>{t('status.notSent')}</StatusPill>
  const { paid, total } = paidSummary(data)
  if (total > 0 && paid === total) return <StatusPill tone="ok">{t('status.allPaid')}</StatusPill>
  return <StatusPill tone="warn">{t('status.paidOf', { paid, total })}</StatusPill>
}

// One saved bill in Home's "Recent bills" and in History.
export default function BillRow({ bill, onOpen }) {
  const { t, i18n } = useTranslation()
  const { fmt } = useCurrency()
  const date = formatShortDate(bill.createdAt, i18n.language)
  const people = t('billHistory.peopleCount', { count: bill.activeMembers?.length || 0 })
  return (
    <button type="button" onClick={() => onOpen(bill)} className="w-full flex items-center gap-3 min-h-[68px] px-4 py-3 text-left text-ink hover:bg-surface-2">
      <Avatar square size="lg" id={bill.crewId || bill.id} name={bill.crewName} className="text-[20px]">
        {bill.crewEmoji || undefined}
      </Avatar>
      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
        <b className="text-[16px] font-semibold truncate">{bill.crewName || t('home.quickSplit')}</b>
        <small className="text-[14px] text-ink-2 truncate">{date ? `${date} · ${people}` : people}</small>
      </span>
      <span className="flex flex-col items-end gap-1 sm:flex-row-reverse sm:items-center sm:gap-4">
        <b className="num text-[16px] font-semibold sm:min-w-[140px] sm:text-right">{fmt(bill.grandTotal || 0)}</b>
        <BillStatusPill billId={bill.id} />
      </span>
    </button>
  )
}
