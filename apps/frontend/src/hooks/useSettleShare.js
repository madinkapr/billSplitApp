import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocalStorage } from './useLocalStorage'
import { useIsDesktop } from './useIsDesktop'
import { useCurrency } from './useCurrency'
import { copyText } from '../utils/clipboard'
import { getItemShares } from '../utils/math'
import { getUnitPrice } from '../utils/itemizerState'

export function useSettleShare({ bill, results, tipAmount = 0, tipLabel = '' }) {
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
    .map((r) => ({ id: r.id, name: r.name, isMe: r.isMe, amount: r.finalTotal, subtotal: r.subtotal }))

  const totalSubtotal = results.reduce((s, r) => s + (r.subtotal || 0), 0)

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
      .map((item) => `${item.name} - ${fmt(item.price / Math.max(results.length, 1))}`)
  }

  // Same per-person breakdown shown in the "copy summary" text (tip share, dishes,
  // shared items) — appended under each participant's payment link so the message
  // doubles as both "here's your link" and "here's what you're paying for".
  function personDetailLines(p) {
    const lines = []
    if (tipAmount > 0 && totalSubtotal > 0) {
      const personalTip = tipAmount * (p.subtotal / totalSubtotal)
      lines.push(`${tipLabel}: ${fmt(personalTip)}`)
    }
    const personal = personalItemsForMember(p.id)
    if (personal.length > 0) {
      const dishesLabel = p.isMe ? t('report.ateLabel') : t('report.dishesLabel')
      lines.push(`${dishesLabel}:`)
      personal.forEach((name) => lines.push(`- ${name}`))
    }
    const shared = sharedItems()
    if (shared.length > 0) {
      lines.push(`${t('report.everyoneSplitEqually')}:`)
      shared.forEach((name) => lines.push(`- ${name}`))
    }
    return lines
  }

  // The payer has no payment link (they're the one getting paid), but recipients
  // still benefit from seeing the payer's own share for context — same breakdown
  // the payer already sees in their own "copy summary" text.
  function payerBlockText() {
    const payerResult = results.find((r) => r.id === effectivePayerId)
    if (!payerResult) return null
    const p = { id: payerResult.id, name: payerResult.name, isMe: payerResult.isMe, amount: payerResult.finalTotal, subtotal: payerResult.subtotal }
    const header = `${p.name}${p.isMe ? t('common.you') : ''} — ${fmt(p.amount)}`
    return [header, ...personDetailLines(p)].join('\n')
  }

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
  function buildCombinedText(withLinks, { includeDetails = true } = {}) {
    if (!includeDetails) {
      // SMS: no translated sentence at all — the UI language may be Cyrillic (e.g. Russian),
      // and even one non-GSM-7 character forces the whole SMS into UCS-2 encoding (70 chars/
      // segment instead of 160), which is enough on its own to push a short message into MMS
      // territory. Keep it to amount + link (+ name when there's more than one recipient) so
      // the body stays locale-independent and GSM-7-safe.
      if (withLinks.length === 1) {
        return `${fmt(withLinks[0].amount)}\n${withLinks[0].deepLink}`
      }
      return withLinks.map((p) => `${p.name}: ${fmt(p.amount)}\n${p.deepLink}`).join('\n\n')
    }

    const payerBlock = payerBlockText()
    if (withLinks.length === 1) {
      const p = withLinks[0]
      const lines = [`${t('settleUp.shareText', { amount: fmt(p.amount) })} ${p.deepLink}`, ...personDetailLines(p)]
      const text = lines.join('\n')
      return payerBlock ? `${text}\n\n${payerBlock}` : text
    }
    const blocks = withLinks.map((p) => [`${p.name}${p.isMe ? t('common.you') : ''} — ${fmt(p.amount)}`, p.deepLink, ...personDetailLines(p)].join('\n'))
    const allBlocks = payerBlock ? [payerBlock, ...blocks] : blocks
    return `${t('settleUp.shareTextMultiIntro')}\n\n${allBlocks.join('\n\n')}`
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
    const selected = participants.filter((p) => selectedIds.has(p.id))
    if (selected.length === 0) return

    setSubmitting(true)
    setSubmitError(null)
    setSent(false)
    try {
      const session = await createSession(selected)
      const byLocalId = new Map(session.participants.map((p) => [p.localId, p]))
      const withLinks = selected.map((p) => ({ ...p, deepLink: byLocalId.get(p.id)?.deepLink }))
      const combinedText = buildCombinedText(withLinks, { includeDetails: method !== 'sms' })

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
