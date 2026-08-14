import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocalStorage } from './useLocalStorage'
import { useIsDesktop } from './useIsDesktop'
import { useCurrency } from './useCurrency'
import { copyText } from '../utils/clipboard'

export function useSettleShare({ bill, results }) {
  const { t, i18n } = useTranslation()
  const { fmt } = useCurrency()
  const isDesktop = useIsDesktop()
  const [payerInfo, setPayerInfo] = useLocalStorage('tabup_payer_info', { name: '', contact: '', contactType: 'card' })

  const [isOpen, setIsOpen] = useState(false)
  const [payerId, setPayerId] = useState(null)
  const [payerName, setPayerName] = useState(payerInfo.name || '')
  const [payerContact, setPayerContact] = useState(payerInfo.contact || '')
  const [payerContactType, setPayerContactType] = useState(payerInfo.contactType || 'card')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [sent, setSent] = useState(false)
  const [copied, setCopied] = useState(false)

  const canShare = results.length > 1
  const payerOptions = results
  const effectivePayerId = payerId ?? (results.find((r) => r.isMe)?.id ?? results[0]?.id)

  const participants = results
    .filter((r) => r.id !== effectivePayerId)
    .map((r) => ({ id: r.id, name: r.name, isMe: r.isMe, amount: r.finalTotal }))

  function open() {
    setIsOpen(true)
    setSelectedIds(new Set(participants.map((p) => p.id)))
    setSent(false)
    setSubmitError(null)
  }

  function close() {
    setIsOpen(false)
  }

  function toggle() {
    if (isOpen) close()
    else open()
  }

  function toggleParticipant(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const isAllSelected = participants.length > 0 && participants.every((p) => selectedIds.has(p.id))

  function toggleSelectAll() {
    setSelectedIds(isAllSelected ? new Set() : new Set(participants.map((p) => p.id)))
  }

  // One combined message covers everyone selected, so this only ever opens a single
  // window/share-sheet per click — no per-recipient popup-blocking issue on any channel.
  function buildCombinedText(withLinks) {
    if (withLinks.length === 1) {
      const p = withLinks[0]
      return `${t('settleUp.shareText', { amount: fmt(p.amount) })} ${p.deepLink}`
    }
    const blocks = withLinks.map((p) => `${p.name} — ${fmt(p.amount)}\n${p.deepLink}`)
    return `${t('settleUp.shareTextMultiIntro')}\n\n${blocks.join('\n\n')}`
  }

  async function createSession(selected) {
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
        participants: selected.map((p) => ({ localId: p.id, name: p.name, amount: p.amount })),
      }),
    })
    if (!res.ok) throw new Error('server_error')
    return res.json()
  }

  async function shareVia(method) {
    if (!payerName.trim() || !payerContact.trim()) {
      setSubmitError(t('settleUp.submitError'))
      return
    }
    const selected = participants.filter((p) => selectedIds.has(p.id))
    if (selected.length === 0) return

    setSubmitting(true)
    setSubmitError(null)
    setSent(false)
    try {
      const session = await createSession(selected)
      const byLocalId = new Map(session.participants.map((p) => [p.localId, p]))
      const withLinks = selected.map((p) => ({ ...p, deepLink: byLocalId.get(p.id)?.deepLink }))
      const combinedText = buildCombinedText(withLinks)

      if (method === 'sms') {
        window.location.href = `sms:?body=${encodeURIComponent(combinedText)}`
      } else if (method === 'other' && navigator.share) {
        try {
          await navigator.share({ text: combinedText })
        } catch (err) {
          if (err?.name !== 'AbortError') {
            await copyText(combinedText)
            setCopied(true)
            setTimeout(() => setCopied(false), 3000)
          }
        }
      } else if (method === 'telegram') {
        // t.me/share/url is what gives Telegram's own "choose a chat" picker — it always requires
        // a `url` param though (bare `t.me` with nothing else just redirects to the telegram.org
        // marketing site, and omitting `url` breaks the picker entirely). Using the bot's bare
        // profile link (no ?start= token) here keeps that mandatory link generic rather than
        // making it look like it belongs to any one selected participant — everyone's own
        // personal link is still in the message text below it.
        const botProfileUrl = withLinks[0]?.deepLink?.split('?')[0] ?? ''
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(botProfileUrl)}&text=${encodeURIComponent(combinedText)}`
        const opened = window.open(shareUrl, '_blank', 'noreferrer')
        if (!opened) {
          await copyText(combinedText)
          setCopied(true)
          setTimeout(() => setCopied(false), 3000)
        }
      } else {
        const shareUrl = `https://wa.me/?text=${encodeURIComponent(combinedText)}`
        // noopener is intentionally omitted here: browsers are inconsistent about the return
        // value of window.open() when noopener is set (some return null even on success), which
        // made the popup-blocked check below unreliable. wa.me is a trusted, fixed destination.
        const opened = window.open(shareUrl, '_blank', 'noreferrer')
        if (!opened) {
          // popup blocked — fall back to copying the message so it can be pasted manually
          await copyText(combinedText)
          setCopied(true)
          setTimeout(() => setCopied(false), 3000)
        }
      }

      setSent(true)
      setPayerInfo({ name: payerName.trim(), contact: payerContact.trim(), contactType: payerContactType })
    } catch {
      setSubmitError(t('settleUp.submitError'))
    } finally {
      setSubmitting(false)
    }
  }

  return {
    isOpen,
    open,
    close,
    toggle,
    canShare,
    payerOptions,
    payerId: effectivePayerId,
    setPayerId,
    payerName,
    setPayerName,
    payerContact,
    setPayerContact,
    payerContactType,
    setPayerContactType,
    participants,
    selectedIds,
    toggleParticipant,
    isAllSelected,
    toggleSelectAll,
    isDesktop,
    submitting,
    submitError,
    sent,
    copied,
    shareVia,
  }
}
