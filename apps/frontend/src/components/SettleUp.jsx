import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Check, Send, Bell, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { calculateSplits } from '../utils/math'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useCurrency } from '../hooks/useCurrency'

function ParticipantRow({ participant, onShare, onRemind, reminding, copied }) {
  const { t } = useTranslation()
  const { fmt } = useCurrency()
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-sm flex-shrink-0">
        {participant.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{participant.name}</p>
        <p className="text-xs text-gray-400">{fmt(participant.amount)}</p>
      </div>
      {participant.paid ? (
        <span className="text-xs font-semibold text-green-600 flex items-center gap-1 flex-shrink-0">
          <Check size={14} /> {t('settleUp.paid')}
        </span>
      ) : (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => onShare(participant)}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-indigo-500 transition-colors rounded-lg"
            title={t('settleUp.sendTelegram')}
          >
            {copied ? <Check size={16} className="text-green-500" /> : <Send size={15} />}
          </button>
          {participant.hasChatId && (
            <button
              onClick={() => onRemind(participant)}
              disabled={reminding}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-amber-500 transition-colors rounded-lg disabled:opacity-40"
              title={t('settleUp.remind')}
            >
              {reminding ? <Loader2 size={15} className="animate-spin" /> : <Bell size={15} />}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function SettleUp({ bill, onBack, onChange }) {
  const { t, i18n } = useTranslation()
  const { fmt } = useCurrency()
  const [payerInfo, setPayerInfo] = useLocalStorage('tabup_payer_info', { name: '', contact: '', contactType: 'card' })

  const allMembers = bill._adhocMembers || []
  const activeMembers = allMembers.filter((m) => bill.activeMembers.includes(m.id))
  const meMember = activeMembers.find((m) => m.isMe) || activeMembers[0]

  const [payerId, setPayerId] = useState(meMember?.id)
  const [payerName, setPayerName] = useState(payerInfo.name || meMember?.name || '')
  const [payerContact, setPayerContact] = useState(payerInfo.contact || '')
  const [payerContactType, setPayerContactType] = useState(payerInfo.contactType || 'card')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const [status, setStatus] = useState(null)
  const [remindingId, setRemindingId] = useState(null)
  const [copiedId, setCopiedId] = useState(null)

  const hasSession = !!bill.settleBillId

  const fetchStatus = useCallback(async () => {
    if (!bill.settleBillId) return
    try {
      const res = await fetch(`/api/settle/bills/${bill.settleBillId}/status`)
      if (!res.ok) return
      setStatus(await res.json())
    } catch {
      // transient poll error — will retry on next tick
    }
  }, [bill.settleBillId])

  useEffect(() => {
    if (!hasSession) return
    fetchStatus()
    const interval = setInterval(fetchStatus, 10000)
    return () => clearInterval(interval)
  }, [hasSession, fetchStatus])

  async function handleCreateSession() {
    if (!payerContact.trim() || !payerName.trim()) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const results = calculateSplits({
        items: bill.items || [],
        members: activeMembers,
        grandTotal: bill.grandTotal || 0,
      })
      const participants = results.filter((r) => r.id !== payerId)

      const res = await fetch('/api/settle/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          localId: bill.id,
          crewName: bill.crewName,
          grandTotal: bill.grandTotal,
          tipAmount: bill.tipAmount,
          tipPercent: bill.tipPercent,
          payerName: payerName.trim(),
          payerContact: payerContact.trim(),
          payerContactType,
          language: i18n.language,
          participants: participants.map((p) => ({ localId: p.id, name: p.name, amount: p.finalTotal })),
        }),
      })
      if (!res.ok) throw new Error('server_error')
      const json = await res.json()

      setPayerInfo({ name: payerName.trim(), contact: payerContact.trim(), contactType: payerContactType })
      onChange({ ...bill, settleBillId: json.billId })
    } catch {
      setSubmitError(t('settleUp.submitError'))
    } finally {
      setSubmitting(false)
    }
  }

  async function shareLink(participant) {
    const text = t('settleUp.shareText', { amount: fmt(participant.amount) })
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(participant.deepLink)}&text=${encodeURIComponent(text)}`
    const opened = window.open(shareUrl, '_blank', 'noopener,noreferrer')

    if (opened) return

    // popup blocked — fall back to copying the message so it can be pasted manually
    const fullText = `${text} ${participant.deepLink}`
    try {
      await navigator.clipboard.writeText(fullText)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = fullText
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopiedId(participant.localId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  async function remindNow(participant) {
    setRemindingId(participant.localId)
    try {
      const res = await fetch(`/api/settle/participants/${participant.id}/remind`, { method: 'POST' })
      if (res.status === 409) {
        const json = await res.json()
        alert(
          json.error === 'not_started'
            ? t('settleUp.remindNotStarted')
            : t('settleUp.remindAlreadyPaid')
        )
      } else if (!res.ok) {
        alert(t('settleUp.remindFailed'))
      }
      fetchStatus()
    } finally {
      setRemindingId(null)
    }
  }

  const paidCount = status?.participants.filter((p) => p.paid).length ?? 0
  const totalCount = status?.participants.length ?? 0

  return (
    <div className="flex flex-col min-h-screen pb-8">
      <div className="flex items-center gap-3 px-4 pt-12 pb-4">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold flex-1">{t('settleUp.title')}</h1>
      </div>

      <div className="px-5 flex flex-col gap-4">
        {!hasSession && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="card p-5 flex flex-col gap-4">
            <div>
              <h2 className="font-bold text-gray-800 mb-1">{t('settleUp.payerInfoTitle')}</h2>
              <p className="text-xs text-gray-400">{t('settleUp.payerInfoSubtitle')}</p>
            </div>

            {activeMembers.length > 1 && (
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">{t('settleUp.whoPaid')}</label>
                <select
                  className="input-field w-full"
                  value={payerId}
                  onChange={(e) => setPayerId(e.target.value)}
                >
                  {activeMembers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}{m.isMe ? t('common.you') : ''}</option>
                  ))}
                </select>
              </div>
            )}

            <input
              className="input-field"
              placeholder={t('settleUp.namePlaceholder')}
              value={payerName}
              onChange={(e) => setPayerName(e.target.value)}
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
                  onClick={() => setPayerContactType(opt.value)}
                  className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-colors ${
                    payerContactType === opt.value ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <input
              className="input-field"
              placeholder={payerContactType === 'card' ? t('settleUp.cardNumberPlaceholder') : t('settleUp.phoneNumberPlaceholder')}
              value={payerContact}
              onChange={(e) => setPayerContact(e.target.value)}
              maxLength={40}
              inputMode="numeric"
            />
            <p className="text-xs text-gray-400 -mt-1">
              {t('settleUp.disclaimer')}
            </p>

            {submitError && <p className="text-xs text-red-500">{submitError}</p>}

            <button
              onClick={handleCreateSession}
              disabled={submitting || !payerName.trim() || !payerContact.trim()}
              className="btn-primary w-full disabled:opacity-40"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : t('settleUp.createLinks')}
            </button>
          </motion.div>
        )}

        {hasSession && (
          <>
            <div className="card p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-800">{t('settleUp.paymentStatus')}</p>
                <p className="text-xs text-gray-400">{t('settleUp.paidCount', { paid: paidCount, total: totalCount })}</p>
              </div>
              {!status && <Loader2 size={18} className="animate-spin text-gray-300" />}
            </div>

            {status && (
              <div className="card divide-y divide-gray-50">
                {status.participants.map((p) => (
                  <ParticipantRow
                    key={p.id}
                    participant={p}
                    onShare={shareLink}
                    onRemind={remindNow}
                    reminding={remindingId === p.localId}
                    copied={copiedId === p.localId}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
