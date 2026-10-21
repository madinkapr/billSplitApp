import React from 'react'
import { Send, MessageCircle, MessageSquare, MoreHorizontal, Check, Loader2, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCurrency } from '../hooks/useCurrency'
import Sheet from '../ui/Sheet'
import Segmented from '../ui/Segmented'

const fieldClass = 'w-full min-h-[48px] px-3.5 rounded-ctl border border-line-strong bg-surface text-[16px] text-ink placeholder:text-ink-2 focus:outline focus:outline-2 focus:outline-accent focus:border-transparent'

// Payment links for the people who owe the payer: payer details, who to send to, and the
// channel. A bottom sheet on phones, a dialog on desktop. All state lives in useSettleShare.
export default function SettleShareMenu({ share }) {
  const { t } = useTranslation()
  const { fmt } = useCurrency()

  if (!share.isOpen) return null

  const nameMissing = !share.payerName.trim()
  const contactMissing = !share.payerContact.trim()
  const warningKey = nameMissing && contactMissing
    ? 'settleUp.nameAndContactMissingWarning'
    : nameMissing
      ? 'settleUp.nameMissingWarning'
      : contactMissing
        ? 'settleUp.contactMissingWarning'
        : null

  const channels = [
    { id: 'telegram', label: 'Telegram', icon: Send },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
    ...(!share.isDesktop ? [{ id: 'sms', label: 'SMS', icon: MessageSquare }] : []),
    ...(typeof navigator !== 'undefined' && navigator.share ? [{ id: 'other', label: t('settleUp.shareOther'), icon: MoreHorizontal }] : []),
  ]

  return (
    <Sheet title={t('settleUp.title')} subtitle={t('settleUp.payerInfoSubtitle')} onClose={share.close}>
      <section className="flex flex-col gap-2.5" aria-labelledby="payer-title">
        <h3 id="payer-title" className="text-[15px] font-semibold">{t('settleUp.payerInfoTitle')}</h3>
        {share.payerOptions.length > 1 && (
          <>
            <label htmlFor="payer-who" className="text-[14px] text-ink-2">{t('settleUp.whoPaid')}</label>
            <select id="payer-who" className={fieldClass} value={share.payerId} onChange={(e) => share.setPayerId(e.target.value)}>
              {share.payerOptions.map((m) => (
                <option key={m.id} value={m.id}>{m.name}{m.isMe ? t('common.you') : ''}</option>
              ))}
            </select>
          </>
        )}
        <label htmlFor="payer-name" className="sr-only">{t('settleUp.namePlaceholder')}</label>
        <input id="payer-name" className={fieldClass} placeholder={t('settleUp.namePlaceholder')} value={share.payerName} onChange={(e) => share.setPayerName(e.target.value)} maxLength={30} />
        <Segmented
          labelledBy="payer-title"
          value={share.payerContactType}
          onChange={share.setPayerContactType}
          options={[{ value: 'card', label: t('settleUp.cardNumber') }, { value: 'phone', label: t('settleUp.phoneNumber') }]}
        />
        <label htmlFor="payer-contact" className="sr-only">{share.payerContactType === 'card' ? t('settleUp.cardNumber') : t('settleUp.phoneNumber')}</label>
        <input
          id="payer-contact"
          className={`${fieldClass} num`}
          placeholder={share.payerContactType === 'card' ? t('settleUp.cardNumberPlaceholder') : t('settleUp.phoneNumberPlaceholder')}
          value={share.payerContact}
          onChange={(e) => share.setPayerContact(e.target.value)}
          maxLength={40}
          inputMode="numeric"
        />
        {warningKey && (
          <p className="flex items-start gap-2 rounded-ctl bg-warn-tint text-warn px-3 py-2 text-[14px]">
            <AlertTriangle size={16} className="mt-0.5 flex-none" aria-hidden="true" />
            {t(warningKey)}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-1" aria-labelledby="send-to-title">
        <div className="flex items-center justify-between">
          <h3 id="send-to-title" className="text-[15px] font-semibold">{t('settleUp.sendTo')}</h3>
          <button type="button" onClick={share.toggleSelectAll} className="inline-flex items-center min-h-[44px] text-[15px] font-semibold text-link hover:underline">
            {t('settleUp.selectAll')}
          </button>
        </div>
        <ul className="flex flex-col">
          {share.participants.map((p) => (
            <li key={p.id}>
              <label className="flex items-center gap-3 min-h-[48px] px-1 rounded-ctl hover:bg-surface-2 cursor-pointer">
                <input type="checkbox" checked={share.selectedIds.has(p.id)} onChange={() => share.toggleParticipant(p.id)} className="w-5 h-5 accent-[var(--accent)] flex-none" />
                <span className="flex-1 min-w-0 truncate text-[15px] font-medium">{p.name}{p.isMe ? t('common.you') : ''}</span>
                <span className="num text-[15px] font-semibold text-ink-2">{fmt(p.amount)}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      {share.submitError && <p role="alert" className="text-[14px] text-warn">{share.submitError}</p>}

      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${channels.length}, minmax(0, 1fr))` }}>
        {channels.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => share.shareVia(id)}
            disabled={share.submitting || share.selectedIds.size === 0}
            className="flex flex-col items-center justify-center gap-1 min-h-[64px] rounded-ctl border border-line bg-surface hover:bg-surface-2 text-[13px] font-semibold text-ink disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icon size={20} className="text-accent-ink" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      <div aria-live="polite" className="min-h-[20px] text-[14px] font-semibold">
        {share.submitting && (
          <span className="flex items-center justify-center gap-2 text-ink-2">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" /> {t('settleUp.createLinks')}
          </span>
        )}
        {!share.submitting && share.copied && (
          <span className="flex items-center gap-1.5 text-accent-ink">
            <Check size={16} aria-hidden="true" /> {t('settleUp.copiedFallback')}
          </span>
        )}
        {!share.submitting && !share.copied && share.sent && (
          <span className="flex items-center gap-1.5 text-ok">
            <Check size={16} aria-hidden="true" /> {t('settleUp.allSent')}
          </span>
        )}
      </div>
    </Sheet>
  )
}
