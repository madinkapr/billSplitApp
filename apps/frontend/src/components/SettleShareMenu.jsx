import React, { useLayoutEffect, useRef, useState } from 'react'
import { Send, MessageCircle, MessageSquare, MoreHorizontal, Check, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCurrency } from '../hooks/useCurrency'

export default function SettleShareMenu({ share }) {
  const { t } = useTranslation()
  const { fmt } = useCurrency()
  const panelRef = useRef(null)
  const [openUpward, setOpenUpward] = useState(false)

  useLayoutEffect(() => {
    if (!share.isOpen || !panelRef.current) return
    const rect = panelRef.current.getBoundingClientRect()
    setOpenUpward(rect.bottom > window.innerHeight)
  }, [share.isOpen])

  if (!share.isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-10" onClick={share.close} />
      <div
        ref={panelRef}
        className={`absolute z-20 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-lg border border-gray-100 p-4 flex flex-col gap-4 ${
          openUpward ? 'bottom-full mb-2' : 'top-full mt-2'
        }`}
        style={{ width: 'min(92vw, 340px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Payer info */}
        <div className="flex flex-col gap-2.5">
          {share.payerOptions.length > 1 && (
            <select
              className="input-field w-full text-sm"
              value={share.payerId}
              onChange={(e) => share.setPayerId(e.target.value)}
            >
              {share.payerOptions.map((m) => (
                <option key={m.id} value={m.id}>{m.name}{m.isMe ? t('common.you') : ''}</option>
              ))}
            </select>
          )}
          <input
            className="input-field w-full text-sm"
            placeholder={t('settleUp.namePlaceholder')}
            value={share.payerName}
            onChange={(e) => share.setPayerName(e.target.value)}
            maxLength={30}
          />
          <div className="flex gap-2">
            {[
              { value: 'card', label: t('settleUp.cardNumber') },
              { value: 'phone', label: t('settleUp.phoneNumber') },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => share.setPayerContactType(opt.value)}
                className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-colors ${
                  share.payerContactType === opt.value ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <input
            className="input-field w-full text-sm"
            placeholder={share.payerContactType === 'card' ? t('settleUp.cardNumberPlaceholder') : t('settleUp.phoneNumberPlaceholder')}
            value={share.payerContact}
            onChange={(e) => share.setPayerContact(e.target.value)}
            maxLength={40}
            inputMode="numeric"
          />
        </div>

        {/* Participant checklist */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{t('settleUp.sendTo')}</p>
            <button
              type="button"
              onClick={share.toggleSelectAll}
              className="text-[11px] font-semibold text-indigo-500"
            >
              {t('settleUp.selectAll')}
            </button>
          </div>
          <div className="flex flex-col max-h-40 overflow-y-auto">
            {share.participants.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-2 py-1.5 px-1 rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={share.selectedIds.has(p.id)}
                  onChange={() => share.toggleParticipant(p.id)}
                  className="w-4 h-4 accent-indigo-600 flex-shrink-0"
                />
                <span className="flex-1 text-sm font-medium text-gray-700 truncate">{p.name}{p.isMe ? t('common.you') : ''}</span>
                <span className="text-xs font-semibold text-gray-400">{fmt(p.amount)}</span>
              </label>
            ))}
          </div>
        </div>

        {share.submitError && <p className="text-xs text-red-500">{share.submitError}</p>}

        {/* Channel buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => share.shareVia('telegram')}
            disabled={share.submitting}
            className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl bg-gray-50 border border-gray-100 disabled:opacity-40"
          >
            <Send size={18} className="text-indigo-500" />
            <span className="text-[10px] font-semibold text-gray-500">Telegram</span>
          </button>
          <button
            type="button"
            onClick={() => share.shareVia('whatsapp')}
            disabled={share.submitting}
            className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl bg-gray-50 border border-gray-100 disabled:opacity-40"
          >
            <MessageCircle size={18} className="text-green-500" />
            <span className="text-[10px] font-semibold text-gray-500">WhatsApp</span>
          </button>
          {!share.isDesktop && (
            <button
              type="button"
              onClick={() => share.shareVia('sms')}
              disabled={share.submitting}
              className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl bg-gray-50 border border-gray-100 disabled:opacity-40"
            >
              <MessageSquare size={18} className="text-gray-500" />
              <span className="text-[10px] font-semibold text-gray-500">SMS</span>
            </button>
          )}
          {typeof navigator !== 'undefined' && navigator.share && (
            <button
              type="button"
              onClick={() => share.shareVia('other')}
              disabled={share.submitting}
              className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl bg-gray-50 border border-gray-100 disabled:opacity-40"
            >
              <MoreHorizontal size={18} className="text-gray-500" />
              <span className="text-[10px] font-semibold text-gray-500">{t('settleUp.shareOther')}</span>
            </button>
          )}
        </div>

        {share.submitting && (
          <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
            <Loader2 size={14} className="animate-spin" /> {t('settleUp.createLinks')}
          </div>
        )}

        {!share.submitting && share.copied && (
          <p className="text-xs font-semibold text-indigo-600 flex items-center gap-1.5">
            <Check size={14} /> {t('settleUp.copiedFallback')}
          </p>
        )}

        {!share.submitting && !share.copied && share.sent && (
          <p className="text-xs font-semibold text-green-600 flex items-center gap-1.5">
            <Check size={14} /> {t('settleUp.allSent')}
          </p>
        )}
      </div>
    </>
  )
}
