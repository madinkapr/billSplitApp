import React, { useState } from 'react'
import { Copy, Check, Send, Pencil, ChevronDown, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getItemShares } from '../utils/math'
import { isGroupItem } from '../utils/itemizerState'
import { copyText } from '../utils/clipboard'
import { formatShortDate } from '../utils/formatDate'
import { useCurrency } from '../hooks/useCurrency'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { useBillSummary } from '../hooks/useBillSummary'
import { useSettleShare } from '../hooks/useSettleShare'
import { useSettleStatus, rememberSettleBill } from '../hooks/useSettleStatus'
import { useCalorieEstimate } from '../hooks/useCalorieEstimate'
import Page, { PageHeader, ActionBar } from '../ui/Page'
import Card, { List, SectionHead } from '../ui/Card'
import Button from '../ui/Button'
import Avatar from '../ui/Avatar'
import StatusPill from '../ui/StatusPill'
import ProgressBar from '../ui/ProgressBar'
import Skeleton from '../ui/Skeleton'
import SettleShareMenu from '../components/SettleShareMenu'
import CalorieEstimate from '../components/CalorieEstimate'

// "Plov, Shashlik ×2 +3 shared" — what one person had, short enough for one line.
function dishesLine(items, memberId, t) {
  const own = []
  let shared = 0
  items.forEach((item) => {
    const shares = getItemShares(item)
    if (item.everyone === true && Object.keys(shares).length === 0) shared++
    else if (shares[memberId] > 0) {
      if (isGroupItem(item)) shared++
      else own.push(shares[memberId] > 1 ? `${item.name} ×${shares[memberId]}` : item.name)
    }
  })
  const parts = [own.join(', '), shared > 0 ? t('split.plusShared', { count: shared }) : ''].filter(Boolean)
  return parts.join(' ')
}

function PersonStatus({ status, memberId }) {
  const { t } = useTranslation()
  if (!status.data) return status.loading ? <Skeleton className="h-6 w-16 !rounded-full" /> : null
  const p = status.data.participants.find((x) => x.localId === memberId)
  if (!p) return <StatusPill tone="accent">{t('status.payer')}</StatusPill>
  if (p.paid) return <StatusPill tone="ok">{t('status.paid')}</StatusPill>
  // Opened the bot link: the bot reminds them until they pay.
  if (p.hasChatId) return <StatusPill tone="warn">{t('status.reminded')}</StatusPill>
  return <StatusPill>{t('status.notPaid')}</StatusPill>
}

// Step 3: what everyone pays, the receipt behind it, and sending payment links.
export default function Split({ bill, onBack, onEdit }) {
  const { t, i18n } = useTranslation()
  const { fmt } = useCurrency()
  const isDesktop = useIsDesktop()
  const [copied, setCopied] = useState(false)

  const summary = useBillSummary(bill)
  const status = useSettleStatus(bill?.id)
  const share = useSettleShare({
    bill,
    results: summary?.results ?? [],
    tipAmount: summary?.tipAmount ?? 0,
    tipLabel: summary?.tipLabel ?? '',
    onSessionCreated: (session) => rememberSettleBill(bill.id, session.billId),
  })
  const calorieEstimate = useCalorieEstimate({ bill, activeMembers: summary?.activeMembers ?? [] })
  // Dishes start open where there's room for them.
  const [dishesOpen] = useState(isDesktop)

  if (!bill || !summary) return null

  const { activeMembers, results, grandTotal, tipAmount, discountAmount, foodTotal, tipLabel, verificationSum, sumCheck, buildTextSummary } = summary
  const items = bill.items || []

  async function copySummary() {
    await copyText(buildTextSummary())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const participants = status.data?.participants ?? []
  const owed = participants.reduce((s, p) => s + p.amount, 0)
  const paidBack = participants.filter((p) => p.paid).reduce((s, p) => s + p.amount, 0)
  const unpaid = participants.filter((p) => !p.paid).length
  const shareLabel = status.data && unpaid > 0 ? t('split.remind', { count: unpaid }) : t('split.sendLinks')

  const date = formatShortDate(bill.createdAt, i18n.language)
  const people = t('billHistory.peopleCount', { count: activeMembers.length })

  const copyButtonLabel = copied ? t('report.copied') : t('report.copySummary')

  return (
    <Page tight>
      <PageHeader
        title={bill.crewName || t('report.billSplitFallback')}
        meta={date ? `${date} · ${people}` : people}
        onBack={onBack}
        backLabel={t('split.backHome')}
        actions={
          <Button icon variant="secondary" onClick={onEdit} aria-label={t('split.edit')}>
            <Pencil size={18} aria-hidden="true" />
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(300px,1fr)_minmax(0,1.5fr)] lg:[grid-template-areas:'summary_people'_'items_people'] lg:gap-x-8 lg:gap-y-6 lg:items-start">
        <Card aria-label={t('split.summary')} className="lg:[grid-area:summary]">
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] font-medium text-ink-2">{t('setup.totalTitle')}</span>
            <b className="num text-[clamp(32px,3vw+20px,44px)] font-bold tracking-[-0.025em] leading-tight">{fmt(grandTotal)}</b>
          </div>
          <dl className="num grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-[15px] m-0">
            <dt className="text-ink-2">{t('report.food')}</dt>
            <dd className="m-0 text-right">{fmt(foodTotal)}</dd>
            {tipAmount > 0 && (
              <>
                <dt className="text-ink-2">{tipLabel}</dt>
                <dd className="m-0 text-right">{fmt(tipAmount)}</dd>
              </>
            )}
            {discountAmount > 0 && (
              <>
                <dt className="text-ink-2">{t('report.discount')}</dt>
                <dd className="m-0 text-right">−{fmt(discountAmount)}</dd>
              </>
            )}
          </dl>
          {sumCheck ? (
            <p className="flex items-center gap-1.5 text-[14px] text-ok">
              <Check size={16} strokeWidth={2.4} aria-hidden="true" />
              {t('split.addsUp')}
            </p>
          ) : (
            <p className="flex items-center gap-1.5 text-[14px] text-warn">
              <AlertTriangle size={16} aria-hidden="true" />
              {t('report.roundingDiff', { amount: fmt(Math.abs(verificationSum - grandTotal)) })}
            </p>
          )}
          {status.data && participants.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-line pt-4">
              <div className="flex justify-between gap-3 text-[15px] font-semibold">
                <span>{status.data.payerName ? t('split.paidBackTo', { name: status.data.payerName }) : t('split.paidBack')}</span>
                <span className="num">{t('split.amountOf', { paid: fmt(paidBack), total: fmt(owed) })}</span>
              </div>
              <ProgressBar value={owed > 0 ? (paidBack / owed) * 100 : 0} tone="ok" label={t('split.paidBack')} />
            </div>
          )}
        </Card>

        <section aria-labelledby="people-title" className="flex flex-col gap-2.5 min-w-0 lg:[grid-area:people]">
          <SectionHead
            id="people-title"
            title={t('split.eachPays')}
            action={
              <div className="hidden lg:flex gap-2">
                <Button size="sm" onClick={copySummary}>
                  {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
                  {copyButtonLabel}
                </Button>
                {share.canShare && (
                  <Button size="sm" variant="primary" onClick={share.open}>
                    <Send size={18} aria-hidden="true" />
                    {shareLabel}
                  </Button>
                )}
              </div>
            }
          />
          <List as="ul">
            {results.map((r) => (
              <li key={r.id} className="flex items-center gap-3 min-h-[72px] px-4 py-3">
                <Avatar size="lg" id={r.id} name={r.name} />
                <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <b className="text-[16px] font-semibold truncate">{r.name}{r.isMe ? t('common.you') : ''}</b>
                  <small className="text-[14px] text-ink-2 truncate">{dishesLine(items, r.id, t) || t('report.everyoneSplitEqually')}</small>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <b className="num text-[17px] font-bold">{fmt(r.finalTotal)}</b>
                  <PersonStatus status={status} memberId={r.id} />
                </span>
              </li>
            ))}
          </List>
        </section>

        {items.length > 0 && (
          <div className="flex flex-col gap-4 min-w-0 lg:[grid-area:items]">
            <details open={dishesOpen} className="group bg-surface border border-line rounded-card p-4 sm:p-5">
              <summary className="flex items-center justify-between min-h-[44px] cursor-pointer list-none text-[18px] font-semibold [&::-webkit-details-marker]:hidden">
                {t('split.dishes', { count: items.length })}
                <ChevronDown size={20} className="transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="num grid grid-cols-[1fr_auto] gap-x-4 gap-y-2.5 pt-3 text-[15px] !whitespace-normal">
                {items.map((item) => {
                  const shares = getItemShares(item)
                  const counts = Object.values(shares)
                  const allEqual = counts.every((c) => c === counts[0])
                  const names = activeMembers.filter((m) => shares[m.id] > 0).map((m) => (allEqual ? m.name : `${m.name} ×${shares[m.id]}`))
                  const who = names.length === 0 ? t('report.everyoneSplitEqually') : isGroupItem(item) ? t('report.splitBetween', { names: names.join(', ') }) : names.join(', ')
                  return (
                    <React.Fragment key={item.id}>
                      <span className="min-w-0">
                        {item.name || t('report.itemFallback')}
                        {item.quantity > 1 && ` ×${item.quantity}`}
                        <small className="block text-[13px] text-ink-2">{who}</small>
                      </span>
                      <span className="text-right whitespace-nowrap">{fmt(item.price)}</span>
                    </React.Fragment>
                  )
                })}
              </div>
            </details>
            <CalorieEstimate estimate={calorieEstimate} />
          </div>
        )}
      </div>

      <ActionBar className="lg:hidden">
        {share.canShare ? (
          <>
            <Button variant="secondary" onClick={copySummary} aria-label={copyButtonLabel} className="!w-[54px] !h-[54px] !px-0 !rounded-[14px] flex-none">
              {copied ? <Check size={20} aria-hidden="true" /> : <Copy size={20} aria-hidden="true" />}
            </Button>
            <Button variant="primary" size="lg" className="flex-1 sm:flex-none sm:min-w-[240px] sm:ml-auto" onClick={share.open}>
              <Send size={20} aria-hidden="true" />
              {shareLabel}
            </Button>
          </>
        ) : (
          <Button variant="primary" size="lg" block onClick={copySummary}>
            {copied ? <Check size={20} aria-hidden="true" /> : <Copy size={20} aria-hidden="true" />}
            {copyButtonLabel}
          </Button>
        )}
      </ActionBar>
      <p className="sr-only" aria-live="polite">{copied ? t('report.copied') : ''}</p>

      <SettleShareMenu share={share} />
    </Page>
  )
}
