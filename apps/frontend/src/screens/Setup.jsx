import React, { useEffect, useRef, useState } from 'react'
import { ArrowRight, UserPlus, X, ScanLine, Mic, MicOff, Loader2, Check, AlertCircle, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { generateId } from '../utils/math'
import { amountToInput } from '../utils/money'
import { useOcr } from '../hooks/useOcr'
import { useCurrency } from '../hooks/useCurrency'
import { useVoiceInput } from '../hooks/useVoiceInput'
import { voiceErrorMessage } from '../utils/voiceErrors'
import { trackManualEntry, trackVoiceEntry } from '../utils/analytics'
import Page, { PageHeader, ActionBar, ActionSum } from '../ui/Page'
import Card, { SectionHead } from '../ui/Card'
import Button from '../ui/Button'
import Avatar from '../ui/Avatar'
import StatusPill from '../ui/StatusPill'
import Stepper from '../ui/Stepper'
import Segmented from '../ui/Segmented'
import MoneyInput from '../ui/MoneyInput'
import OcrReviewModal from '../components/OcrReviewModal'
import VoiceBillReviewModal from '../components/VoiceBillReviewModal'

const SERVICE_PRESETS = [0, 10, 12, 15]

const inputClass = 'w-full min-h-[48px] px-3.5 rounded-ctl border border-line-strong bg-surface text-[16px] text-ink placeholder:text-ink-2 focus:outline focus:outline-2 focus:outline-accent focus:border-transparent'

// "Have the receipt?" — scan or dictate from inside the form (e.g. after picking a crew).
function QuickFill({ onScanFile, onVoiceResult }) {
  const { t } = useTranslation()
  const fileRef = useRef(null)
  const voice = useVoiceInput('/api/voice/bill', { timeout: 90000 })

  async function onVoice() {
    if (voice.state === 'idle' || voice.state === 'error') {
      voice.startRecording()
      return
    }
    if (voice.state !== 'recording') return
    try {
      const data = await voice.stopRecording()
      if (data) onVoiceResult(data)
    } catch {
      // shown below via voice.errorCode
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <span className="text-[15px] text-ink-2 sm:mr-1">{t('setup.quickFill')}</span>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button size="sm" variant="tint" onClick={() => fileRef.current?.click()}>
            <ScanLine size={18} aria-hidden="true" />
            {t('home.scanTile')}
          </Button>
          <Button
            size="sm"
            variant={voice.state === 'recording' ? 'primary' : 'tint'}
            aria-pressed={voice.state === 'recording'}
            disabled={voice.state === 'processing'}
            onClick={onVoice}
          >
            {voice.state === 'processing' ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Mic size={18} aria-hidden="true" />}
            {voice.state === 'recording' ? t('home.voiceRecording') : voice.state === 'processing' ? t('billSetup.voiceProcessing') : t('home.voiceTile')}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) onScanFile(file)
            }}
          />
        </div>
      </div>
      {voice.state === 'error' && <p role="alert" className="text-[14px] text-warn">{voiceErrorMessage(t, voice.errorCode)}</p>}
    </div>
  )
}

// scanState: 'idle' | 'scanning' | 'success' | 'error'
function ScanBanner({ scanState, dishCount, errorMessage, onReview, onRetry }) {
  const { t } = useTranslation()
  if (scanState === 'scanning') {
    return (
      <div role="status" className="flex items-center gap-2.5 rounded-ctl px-3 py-2.5 text-[15px] bg-accent-tint text-accent-ink">
        <Loader2 size={20} className="animate-spin flex-none" aria-hidden="true" />
        <span>
          <b className="font-semibold">{t('billSetup.scanning')}</b> {t('billSetup.scanningSubtitle')}
        </span>
      </div>
    )
  }
  if (scanState === 'success') {
    return (
      <div role="status" className="flex items-center gap-2.5 rounded-ctl px-3 py-2.5 text-[15px] bg-ok-tint text-ok">
        <Check size={20} strokeWidth={2.2} className="flex-none" aria-hidden="true" />
        <span className="min-w-0">
          <b className="font-semibold">{t('setup.scanned')}</b> {t('setup.dishesFound', { count: dishCount })}
        </span>
        <button type="button" onClick={onReview} className="ml-auto inline-flex items-center min-h-[44px] px-1 font-semibold underline underline-offset-[3px]">
          {t('setup.review')}
        </button>
      </div>
    )
  }
  if (scanState === 'error') {
    return (
      <div role="alert" className="flex items-center gap-2.5 rounded-ctl px-3 py-2.5 text-[15px] bg-warn-tint text-warn">
        <AlertCircle size={20} className="flex-none" aria-hidden="true" />
        <span className="min-w-0">
          <b className="font-semibold">{t('billSetup.scanFailed')}.</b> {errorMessage}
        </span>
        <button type="button" onClick={onRetry} className="ml-auto inline-flex items-center gap-1 min-h-[44px] px-1 font-semibold underline underline-offset-[3px] flex-none">
          <RefreshCw size={16} aria-hidden="true" />
          {t('billSetup.tryAgain')}
        </button>
      </div>
    )
  }
  return null
}

// Step 1 of 3: the receipt total, service charge, discount and who is at the table.
export default function Setup({ bill, crews, onBack, onNext }) {
  const { t } = useTranslation()
  const { fmt, roundForCurrency, symbol } = useCurrency()
  const crewMembers = (() => {
    if (bill.crewId) {
      const crew = crews?.find((c) => c.id === bill.crewId)
      return crew?.members || []
    }
    return bill._adhocMembers || [{ id: 'me', name: 'Me', isMe: true }]
  })()

  const [activeMembers, setActiveMembers] = useState(
    bill.activeMembers.length > 0 ? bill.activeMembers : crewMembers.map((m) => m.id)
  )
  const [grandTotal, setGrandTotal] = useState(amountToInput(bill.grandTotal))
  const [tipMode, setTipMode] = useState(bill.tipMode || 'percent')
  const [tipPercent, setTipPercent] = useState(bill.tipPercent ?? null)
  const [tipAmountInput, setTipAmountInput] = useState(amountToInput(bill.tipAmount))
  const [otherOpen, setOtherOpen] = useState(
    (bill.tipMode || 'percent') === 'amount' || (bill.tipPercent != null && !SERVICE_PRESETS.includes(bill.tipPercent))
  )
  const [newMemberName, setNewMemberName] = useState('')
  const [adhocMembers, setAdhocMembers] = useState(crewMembers)
  const [discountAmount, setDiscountAmount] = useState(amountToInput(bill.discountAmount || ''))
  const [showDiscount, setShowDiscount] = useState(!!bill.discountAmount)
  const [ocrItems, setOcrItems] = useState([])

  const [scanState, setScanState] = useState('idle')
  const [ocrData, setOcrData] = useState(null)
  const [lastOcr, setLastOcr] = useState(null)
  const [receiptId, setReceiptId] = useState(bill.receiptId || null)
  const [voiceBillData, setVoiceBillData] = useState(bill._voiceData || null)

  const reviewAgainRef = useRef(false)

  const { scanReceipt, retry, error: ocrError } = useOcr()
  const memberVoice = useVoiceInput('/api/voice/members')

  const grandNum = parseFloat(grandTotal) || 0
  const tipAmount = tipMode === 'percent'
    ? (tipPercent != null && grandNum > 0 ? roundForCurrency(grandNum - grandNum / (1 + tipPercent / 100)) : 0)
    : (parseFloat(tipAmountInput) || 0)

  // A receipt photo picked on Home starts scanning as soon as this screen opens.
  const pendingScanUsed = useRef(false)
  useEffect(() => {
    if (bill._pendingScan && !pendingScanUsed.current) {
      pendingScanUsed.current = true
      handleScan(bill._pendingScan)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleScan(file) {
    reviewAgainRef.current = false
    setScanState('scanning')
    try {
      const data = await scanReceipt(file)
      setScanState('success')
      setOcrData(data)
      setLastOcr(data)
      setReceiptId(data.receiptId || null)
    } catch {
      setScanState('error')
    }
  }

  async function handleRetry() {
    reviewAgainRef.current = false
    setScanState('scanning')
    try {
      const data = await retry()
      setScanState('success')
      setOcrData(data)
      setLastOcr(data)
      setReceiptId(data.receiptId || null)
    } catch {
      setScanState('error')
    }
  }

  function openReview() {
    if (!lastOcr) return
    reviewAgainRef.current = true
    setOcrData(lastOcr)
  }

  function handleOcrConfirm(confirmed) {
    setOcrData(null)
    setScanState('success')
    // "Review" reopens the dialog with what was confirmed, not the raw scan.
    setLastOcr((prev) => ({ ...prev, ...confirmed }))

    if (confirmed.grandTotal) setGrandTotal(amountToInput(confirmed.grandTotal))

    if (confirmed.discountAmount) {
      setDiscountAmount(amountToInput(confirmed.discountAmount))
      setShowDiscount(true)
    }

    if (confirmed.tipAmount && confirmed.tipAmount > 0) {
      setTipMode('amount')
      setTipAmountInput(amountToInput(confirmed.tipAmount))
      setOtherOpen(true)
    } else if (confirmed.tipPercent && confirmed.tipPercent > 0) {
      setTipMode('percent')
      setTipPercent(confirmed.tipPercent)
      setOtherOpen(!SERVICE_PRESETS.includes(confirmed.tipPercent))
    }

    setOcrItems(confirmed.items || [])
  }

  function handleOcrCancel() {
    setOcrData(null)
    // Closing "Review" of an already confirmed scan keeps it; closing the first one drops it.
    if (reviewAgainRef.current) return
    setReceiptId(null)
    setLastOcr(null)
    setScanState('idle')
  }

  function handleVoiceBillConfirm(confirmed) {
    setVoiceBillData(null)
    trackVoiceEntry()

    // The spoken "isMe" member folds into whichever member is already flagged
    // isMe (never a second "Me"); everyone else matches by name or is appended.
    const idMap = {}
    const nextAdhoc = [...adhocMembers]
    const nextActive = [...activeMembers]

    confirmed.members.forEach((m) => {
      if (m.isMe) {
        const meEntry = nextAdhoc.find((x) => x.isMe)
        if (meEntry) {
          idMap[m.id] = meEntry.id
          return
        }
      }
      const existing = nextAdhoc.find((x) => x.name.toLowerCase() === m.name.toLowerCase())
      if (existing) {
        idMap[m.id] = existing.id
        return
      }
      const newM = { id: generateId(), name: m.name, isMe: false }
      nextAdhoc.push(newM)
      nextActive.push(newM.id)
      idMap[m.id] = newM.id
    })

    const items = confirmed.items.map((item) => {
      const shares = {}
      Object.entries(item.shares || {}).forEach(([tempId, qty]) => {
        const finalId = idMap[tempId]
        if (finalId) shares[finalId] = (shares[finalId] || 0) + qty
      })
      return { ...item, shares }
    })

    // Resolve a percentage tip to a concrete amount here, the same way handleNext
    // does for the manual flow. Downstream (Assign, useBillSummary) only ever
    // subtracts bill.tipAmount to get the food budget — passing it through as 0
    // with just a tipPercent leaves the budget overstated by the tip, so nothing
    // ever balances and the share/summary buttons stay hidden until a round-trip
    // back through this screen recomputes it.
    const resolvedTipAmount = confirmed.tipAmount > 0
      ? confirmed.tipAmount
      : confirmed.tipPercent > 0 && confirmed.grandTotal > 0
        ? roundForCurrency(confirmed.grandTotal - confirmed.grandTotal / (1 + confirmed.tipPercent / 100))
        : 0

    onNext({
      ...bill,
      _pendingScan: undefined,
      _voiceData: undefined,
      _adhocMembers: nextAdhoc,
      _manualEntry: false,
      activeMembers: nextActive,
      grandTotal: confirmed.grandTotal,
      tipMode: confirmed.tipAmount > 0 ? 'amount' : 'percent',
      tipPercent: confirmed.tipAmount > 0 ? null : confirmed.tipPercent,
      tipAmount: resolvedTipAmount,
      discountAmount: confirmed.discountAmount || 0,
      items,
    })
  }

  function toggleMember(id) {
    setActiveMembers((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function addAdhocMemberByName(rawName) {
    const trimmed = rawName.trim()
    if (!trimmed) return
    if (adhocMembers.some((m) => m.name.toLowerCase() === trimmed.toLowerCase())) return
    const newM = { id: generateId(), name: trimmed, isMe: false }
    setAdhocMembers((prev) => [...prev, newM])
    setActiveMembers((prev) => [...prev, newM.id])
  }

  function addAdhocMember() {
    addAdhocMemberByName(newMemberName)
    setNewMemberName('')
  }

  async function handleMemberVoiceClick() {
    if (memberVoice.state === 'idle' || memberVoice.state === 'error') {
      memberVoice.startRecording()
      return
    }
    if (memberVoice.state !== 'recording') return
    try {
      const data = await memberVoice.stopRecording()
      if (data?.members) data.members.forEach(addAdhocMemberByName)
    } catch {
      // error surfaced via memberVoice.error
    }
  }

  function removeAdhocMember(id) {
    setAdhocMembers((prev) => prev.filter((m) => m.id !== id))
    setActiveMembers((prev) => prev.filter((x) => x !== id))
  }

  function handleNext() {
    if (!grandTotal || parseFloat(grandTotal) <= 0) return
    if (activeMembers.length === 0) return
    const manualEntry = scanState !== 'success'
    if (manualEntry) trackManualEntry(bill.id)
    onNext({
      ...bill,
      _pendingScan: undefined,
      _voiceData: undefined,
      _adhocMembers: adhocMembers,
      activeMembers,
      grandTotal: grandNum,
      tipMode,
      tipPercent: tipMode === 'percent' ? tipPercent : null,
      tipAmount,
      discountAmount: parseFloat(discountAmount) || 0,
      _ocrItems: ocrItems,
      receiptId,
      _manualEntry: manualEntry,
    })
  }

  function chooseService(value) {
    if (value === 'other') {
      setOtherOpen(true)
      if (tipMode === 'percent' && SERVICE_PRESETS.includes(tipPercent ?? 0)) setTipPercent(null)
      return
    }
    setOtherOpen(false)
    setTipMode('percent')
    setTipPercent(value)
  }

  const serviceValue = otherOpen ? 'other' : tipPercent ?? 0
  const serviceOptions = [...SERVICE_PRESETS.map((p) => ({ value: p, label: `${p}%` })), { value: 'other', label: t('billSetup.other') }]
  const canProceed = grandNum > 0 && activeMembers.length > 0
  const activeCount = adhocMembers.filter((m) => activeMembers.includes(m.id)).length
  const crewLine = bill.crewName ? `${bill.crewEmoji || ''} ${bill.crewName}`.trim() : null

  return (
    <Page tight>
      <PageHeader title={t('setup.title')} meta={crewLine} onBack={onBack} backLabel={t('common.back')} />
      <Stepper current={1} />

      <ScanBanner
        scanState={scanState}
        dishCount={lastOcr?.items?.length ?? 0}
        errorMessage={ocrError}
        onReview={openReview}
        onRetry={handleRetry}
      />
      {scanState === 'idle' && !voiceBillData && <QuickFill onScanFile={handleScan} onVoiceResult={setVoiceBillData} />}

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6 lg:items-start">
        <Card aria-labelledby="total-title">
          <h2 id="total-title" className="text-[18px] font-semibold">{t('setup.totalTitle')}</h2>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="bill-total" className="text-[15px] font-medium text-ink-2">{t('setup.totalLabel')}</label>
            <MoneyInput id="bill-total" size="lg" value={grandTotal} onChange={setGrandTotal} />
          </div>

          <div className="flex flex-col gap-2">
            <div id="service-label" className="text-[15px] font-medium text-ink-2">{t('setup.serviceLabel')}</div>
            <Segmented options={serviceOptions} value={serviceValue} onChange={chooseService} labelledBy="service-label" />
            {otherOpen && (
              <div className="flex gap-2">
                {tipMode === 'percent' ? (
                  <div className="flex-1 min-w-0 flex items-center gap-2 min-h-[48px] px-3.5 rounded-ctl border border-line-strong bg-surface focus-within:outline focus-within:outline-2 focus-within:outline-accent focus-within:border-transparent">
                    <label htmlFor="service-custom" className="sr-only">{t('setup.servicePercent')}</label>
                    <input
                      id="service-custom"
                      className="num flex-1 min-w-0 bg-transparent outline-none text-[16px]"
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      autoComplete="off"
                      value={tipPercent ?? ''}
                      onChange={(e) => {
                        const v = e.target.value.replace(',', '.').replace(/[^\d.]/g, '')
                        setTipPercent(v === '' ? null : Math.min(parseFloat(v) || 0, 100))
                      }}
                    />
                    <span aria-hidden="true" className="text-[15px] font-medium text-ink-2">%</span>
                  </div>
                ) : (
                  <MoneyInput className="flex-1 min-w-0" value={tipAmountInput} onChange={setTipAmountInput} aria-label={t('setup.serviceAmount')} />
                )}
                <Segmented
                  className="w-[120px] flex-none"
                  labelledBy="service-label"
                  value={tipMode}
                  onChange={setTipMode}
                  options={[{ value: 'percent', label: '%' }, { value: 'amount', label: symbol }]}
                />
              </div>
            )}
            {grandNum > 0 && tipAmount > 0 && (
              <div className="num flex justify-between gap-3 text-[14px] text-ink-2">
                <span>{t('setup.foodPart', { amount: fmt(grandNum - tipAmount) })}</span>
                <span>{t('setup.servicePart', { amount: fmt(tipAmount) })}</span>
              </div>
            )}
          </div>

          {showDiscount ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="discount" className="text-[15px] font-medium text-ink-2">{t('billSetup.discount')}</label>
                <Button variant="quiet" size="sm" onClick={() => { setDiscountAmount(''); setShowDiscount(false) }}>
                  {t('billSetup.remove')}
                </Button>
              </div>
              <MoneyInput id="discount" value={discountAmount} onChange={setDiscountAmount} autoFocus />
            </div>
          ) : (
            <Button variant="quiet" size="sm" className="self-start" onClick={() => setShowDiscount(true)}>
              {t('billSetup.addDiscount')}
            </Button>
          )}
        </Card>

        <Card aria-labelledby="who-title">
          <SectionHead id="who-title" title={t('billSetup.whosHere')} action={<StatusPill tone="accent">{t('setup.presentOf', { count: activeCount, total: adhocMembers.length })}</StatusPill>} />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2">
            {adhocMembers.map((member) => {
              const on = activeMembers.includes(member.id)
              const removable = !member.isMe && !crewMembers.some((cm) => cm.id === member.id)
              return (
                <div key={member.id} className="relative min-w-0">
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleMember(member.id)}
                    className={`w-full flex items-center gap-2.5 min-h-[56px] rounded-[14px] text-left text-[16px] ${removable ? 'pr-10' : 'pr-3'} ${
                      on ? 'border-2 border-accent pl-[9px] bg-accent-tint text-ink font-semibold' : 'border border-line-strong pl-2.5 bg-surface text-ink-2 font-medium hover:bg-surface-2'
                    }`}
                  >
                    <Avatar size="sm" name={member.name} tone={on ? 'solid' : 'off'} />
                    <span className="truncate">{member.name}{member.isMe ? t('common.you') : ''}</span>
                  </button>
                  {removable && (
                    <button
                      type="button"
                      onClick={() => removeAdhocMember(member.id)}
                      aria-label={t('crews.removeMember', { name: member.name })}
                      className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full inline-flex items-center justify-center text-ink-2 hover:bg-surface-2 hover:text-ink"
                    >
                      <X size={16} aria-hidden="true" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          <div className="flex gap-2">
            <label htmlFor="add-person" className="sr-only">{t('setup.addPerson')}</label>
            <input
              id="add-person"
              className={inputClass}
              placeholder={t('setup.addPerson')}
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addAdhocMember()}
              enterKeyHint="done"
              maxLength={25}
            />
            {newMemberName.trim() ? (
              <Button variant="primary" onClick={addAdhocMember} aria-label={t('setup.addPerson')} className="!w-12 !px-0 flex-none">
                <UserPlus size={20} aria-hidden="true" />
              </Button>
            ) : (
              <Button
                variant={memberVoice.state === 'recording' ? 'primary' : 'tint'}
                onClick={handleMemberVoiceClick}
                disabled={memberVoice.state === 'processing'}
                aria-pressed={memberVoice.state === 'recording'}
                aria-label={t('billSetup.addSomeoneVoice')}
                className={`!w-12 !px-0 flex-none ${memberVoice.state === 'recording' ? 'animate-pulse' : ''}`}
              >
                {memberVoice.state === 'processing' ? (
                  <Loader2 size={20} className="animate-spin" aria-hidden="true" />
                ) : memberVoice.state === 'error' ? (
                  <MicOff size={20} aria-hidden="true" />
                ) : (
                  <Mic size={20} aria-hidden="true" />
                )}
              </Button>
            )}
          </div>
          {memberVoice.state === 'recording' && <p role="status" className="text-[14px] text-ink-2">{t('billSetup.voiceListeningSubtitle')}</p>}
          {memberVoice.state === 'error' && <p role="alert" className="text-[14px] text-warn">{voiceErrorMessage(t, memberVoice.errorCode)}</p>}
        </Card>
      </div>

      <ActionBar>
        <ActionSum label={t('billHistory.peopleCount', { count: activeCount })} value={fmt(grandNum)} />
        <Button variant="primary" size="lg" onClick={handleNext} disabled={!canProceed} className="flex-1 sm:flex-none sm:min-w-[240px] sm:ml-auto">
          {t('setup.next')}
          <ArrowRight size={20} aria-hidden="true" />
        </Button>
      </ActionBar>

      {ocrData && <OcrReviewModal ocrData={ocrData} onConfirm={handleOcrConfirm} onCancel={handleOcrCancel} />}

      {voiceBillData && (
        <VoiceBillReviewModal voiceData={voiceBillData} onConfirm={handleVoiceBillConfirm} onCancel={() => setVoiceBillData(null)} />
      )}
    </Page>
  )
}
