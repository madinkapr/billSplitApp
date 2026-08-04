import React, { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, UserPlus, Trash2, ScanLine, Image, Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'
import { generateId } from '../utils/math'
import { useOcr } from '../hooks/useOcr'
import OcrReviewModal from './OcrReviewModal'

const TIP_PRESETS = [15, 18, 20]

function MemberToggle({ member, active, onToggle }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onToggle}
      className={`flex items-center gap-2.5 py-3 px-4 rounded-xl border-2 transition-all text-sm font-medium ${
        active
          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
          : 'border-gray-100 bg-gray-50 text-gray-400'
      }`}
    >
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${active ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
        {member.name.charAt(0).toUpperCase()}
      </div>
      <span className="truncate">{member.name}{member.isMe ? ' (You)' : ''}</span>
    </motion.button>
  )
}

// scanState: 'idle' | 'scanning' | 'success' | 'error'
function ScanBanner({ scanState, errorMessage, onScan, onRetry, onRescan }) {
  const cameraRef = useRef(null)
  const galleryRef = useRef(null)

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (file) onScan(file)
    e.target.value = ''
  }

  if (scanState === 'idle') {
    return (
      <div className="flex flex-col gap-2">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => cameraRef.current?.click()}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 rounded-2xl bg-indigo-500 text-white shadow-md shadow-indigo-200"
        >
          <div className="flex items-center gap-3">
            <ScanLine size={20} />
            <div className="text-left">
              <p className="text-sm font-semibold">Scan Receipt (camera)</p>
              <p className="text-xs text-indigo-200">Auto-fill totals and items</p>
            </div>
          </div>
          <ArrowRight size={16} className="opacity-70" />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => galleryRef.current?.click()}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 rounded-2xl bg-indigo-50 text-indigo-700"
        >
          <div className="flex items-center gap-3">
            <Image size={20} />
            <div className="text-left">
              <p className="text-sm font-semibold">Scan Receipt (gallery)</p>
              <p className="text-xs text-indigo-400">Auto-fill totals and items</p>
            </div>
          </div>
          <ArrowRight size={16} className="opacity-70" />
          <input ref={galleryRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
        </motion.button>
      </div>
    )
  }

  if (scanState === 'scanning') {
    return (
      <div className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl bg-indigo-50 border-2 border-indigo-200">
        <Loader2 size={20} className="text-indigo-500 animate-spin flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-indigo-700">Scanning receipt…</p>
          <p className="text-xs text-indigo-400">This may take a few seconds</p>
        </div>
      </div>
    )
  }

  if (scanState === 'success') {
    return (
      <div className="w-full flex items-center justify-between gap-3 px-5 py-4 rounded-2xl bg-green-50 border-2 border-green-200">
        <div className="flex items-center gap-3">
          <CheckCircle2 size={20} className="text-green-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-700">Receipt scanned</p>
            <p className="text-xs text-green-500">Fields auto-filled below</p>
          </div>
        </div>
        <button
          onClick={onRescan}
          className="flex items-center gap-1 text-xs text-green-600 font-semibold hover:text-green-700"
        >
          <RefreshCw size={13} /> Rescan
        </button>
      </div>
    )
  }

  // error state
  return (
    <div className="w-full flex items-center justify-between gap-3 px-5 py-4 rounded-2xl bg-red-50 border-2 border-red-200">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <AlertCircle size={20} className="text-red-400 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-red-700">Scan failed</p>
          <p className="text-xs text-red-400 truncate">{errorMessage}</p>
        </div>
      </div>
      <button
        onClick={onRetry}
        className="flex items-center gap-1 text-xs text-red-600 font-semibold hover:text-red-700 flex-shrink-0"
      >
        <RefreshCw size={13} /> Try again
      </button>
    </div>
  )
}

export default function BillSetup({ bill, crews, onBack, onNext }) {
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
  const [grandTotal, setGrandTotal] = useState(bill.grandTotal?.toString() || '')
  const [tipMode, setTipMode] = useState(bill.tipMode || 'percent')
  const [tipPercent, setTipPercent] = useState(bill.tipPercent ?? null)
  const [tipAmountInput, setTipAmountInput] = useState(bill.tipAmount?.toString() || '')
  const [newMemberName, setNewMemberName] = useState('')
  const [adhocMembers, setAdhocMembers] = useState(crewMembers)
  const [discountAmount, setDiscountAmount] = useState(bill.discountAmount?.toString() || '')
  const [showDiscount, setShowDiscount] = useState(!!bill.discountAmount)
  const [ocrItems, setOcrItems] = useState([])

  const [scanState, setScanState] = useState('idle')
  const [ocrData, setOcrData] = useState(null)

  const { scanReceipt, retry, error: ocrError } = useOcr()

  const grandNum = parseFloat(grandTotal) || 0
  const tipAmount = tipMode === 'percent'
    ? (tipPercent != null && grandNum > 0 ? grandNum - grandNum / (1 + tipPercent / 100) : 0)
    : (parseFloat(tipAmountInput) || 0)

  async function handleScan(file) {
    setScanState('scanning')
    try {
      const data = await scanReceipt(file)
      setScanState('success')
      setOcrData(data)
    } catch {
      setScanState('error')
    }
  }

  async function handleRetry() {
    setScanState('scanning')
    try {
      const data = await retry()
      setScanState('success')
      setOcrData(data)
    } catch {
      setScanState('error')
    }
  }

  function handleOcrConfirm(confirmed) {
    setOcrData(null)
    setScanState('success')

    if (confirmed.grandTotal) setGrandTotal(confirmed.grandTotal.toFixed(2))

    if (confirmed.discountAmount) {
      setDiscountAmount(confirmed.discountAmount.toFixed(2))
      setShowDiscount(true)
    }

    if (confirmed.tipAmount && confirmed.tipAmount > 0) {
      setTipMode('amount')
      setTipAmountInput(confirmed.tipAmount.toFixed(2))
    } else if (confirmed.tipPercent && confirmed.tipPercent > 0) {
      setTipMode('percent')
      setTipPercent(confirmed.tipPercent)
    }

    setOcrItems(confirmed.items || [])
  }

  function handleOcrCancel() {
    setOcrData(null)
    setScanState('idle')
  }

  function toggleMember(id) {
    setActiveMembers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  function addAdhocMember() {
    const trimmed = newMemberName.trim()
    if (!trimmed) return
    const newM = { id: generateId(), name: trimmed, isMe: false }
    setAdhocMembers((prev) => [...prev, newM])
    setActiveMembers((prev) => [...prev, newM.id])
    setNewMemberName('')
  }

  function removeAdhocMember(id) {
    setAdhocMembers((prev) => prev.filter((m) => m.id !== id))
    setActiveMembers((prev) => prev.filter((x) => x !== id))
  }

  function handleNext() {
    if (!grandTotal || parseFloat(grandTotal) <= 0) return
    if (activeMembers.length === 0) return
    onNext({
      ...bill,
      _adhocMembers: adhocMembers,
      activeMembers,
      grandTotal: grandNum,
      tipMode,
      tipPercent: tipMode === 'percent' ? tipPercent : null,
      tipAmount,
      discountAmount: parseFloat(discountAmount) || 0,
      _ocrItems: ocrItems,
    })
  }

  const allMembers = bill.crewId ? crewMembers : adhocMembers
  const canProceed = grandNum > 0 && activeMembers.length > 0

  return (
    <div className="flex flex-col min-h-screen pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-4">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold">Bill Setup</h1>
          {bill.crewName && <p className="text-xs text-gray-400">{bill.crewEmoji} {bill.crewName}</p>}
        </div>
      </div>

      <div className="px-5 flex flex-col gap-5">
        {/* Scan Receipt Banner */}
        <ScanBanner
          scanState={scanState}
          errorMessage={ocrError}
          onScan={handleScan}
          onRetry={handleRetry}
          onRescan={() => setScanState('idle')}
        />

        {/* Totals */}
        <div className="card p-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Bill Totals</h2>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">Grand Total *</label>
              <div className="flex items-center border border-gray-200 rounded-xl bg-white focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent">
                <span className="pl-4 text-gray-400 font-medium select-none">$</span>
                <input
                  className="flex-1 px-2 py-3 text-sm bg-transparent outline-none"
                  type="number"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={grandTotal}
                  onChange={(e) => setGrandTotal(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500 font-medium">Tip</label>
                <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-semibold">
                  <button
                    onClick={() => setTipMode('percent')}
                    className={`px-3 py-1 transition-colors ${tipMode === 'percent' ? 'bg-indigo-500 text-white' : 'bg-white text-gray-500'}`}
                  >
                    %
                  </button>
                  <button
                    onClick={() => setTipMode('amount')}
                    className={`px-3 py-1 transition-colors ${tipMode === 'amount' ? 'bg-indigo-500 text-white' : 'bg-white text-gray-500'}`}
                  >
                    $
                  </button>
                </div>
              </div>

              {tipMode === 'percent' ? (
                <div className="flex gap-2">
                  {TIP_PRESETS.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTipPercent(tipPercent === t ? null : t)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                        tipPercent === t
                          ? 'bg-indigo-500 border-indigo-500 text-white'
                          : 'border-gray-200 text-gray-600 bg-white'
                      }`}
                    >
                      {t}%
                    </button>
                  ))}
                  <div className="relative flex-1">
                    <input
                      className={`w-full py-2.5 rounded-xl text-sm font-semibold border-2 text-center transition-all focus:outline-none focus:border-indigo-500 ${
                        tipPercent != null && !TIP_PRESETS.includes(tipPercent)
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 text-gray-500 bg-white'
                      }`}
                      type="number"
                      inputMode="decimal"
                      placeholder="Other"
                      value={tipPercent != null && !TIP_PRESETS.includes(tipPercent) ? tipPercent : ''}
                      onChange={(e) => setTipPercent(parseFloat(e.target.value) || 0)}
                      min="0"
                      max="100"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center border border-gray-200 rounded-xl bg-white focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent">
                  <span className="pl-4 text-gray-400 font-medium select-none">$</span>
                  <input
                    className="flex-1 px-2 py-3 text-sm bg-transparent outline-none"
                    type="number"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={tipAmountInput}
                    onChange={(e) => setTipAmountInput(e.target.value)}
                    min="0"
                    step="0.01"
                  />
                </div>
              )}

              {grandNum > 0 && tipAmount > 0 && (
                <p className="text-xs text-gray-400 mt-1.5">
                  Tip: ${tipAmount.toFixed(2)} · Food subtotal: ${(grandNum - tipAmount).toFixed(2)}
                </p>
              )}
            </div>

            {showDiscount ? (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-500 font-medium">Discount</label>
                  <button
                    onClick={() => {
                      setDiscountAmount('')
                      setShowDiscount(false)
                    }}
                    className="text-xs text-gray-400 font-medium hover:text-gray-600"
                  >
                    Remove
                  </button>
                </div>
                <div className="flex items-center border border-gray-200 rounded-xl bg-white focus-within:ring-2 focus-within:ring-red-400 focus-within:border-transparent">
                  <span className="pl-4 text-red-400 font-medium select-none">-$</span>
                  <input
                    className="flex-1 px-2 py-3 text-sm bg-transparent outline-none"
                    type="number"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    min="0"
                    step="0.01"
                    autoFocus
                  />
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowDiscount(true)}
                className="self-start text-xs text-indigo-500 font-semibold hover:text-indigo-600"
              >
                + Add discount
              </button>
            )}
          </div>
        </div>

        {/* Attendance */}
        <div className="card p-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Who's Here?</h2>
          <div className="flex flex-col gap-2">
            {allMembers.map((member) => (
              <div key={member.id} className="flex items-center gap-2">
                <MemberToggle
                  member={member}
                  active={activeMembers.includes(member.id)}
                  onToggle={() => toggleMember(member.id)}
                />
                {!member.isMe && !bill.crewId && (
                  <button
                    onClick={() => removeAdhocMember(member.id)}
                    className="w-9 h-9 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2 mt-3">
            <input
              className="input-field flex-1 text-sm"
              placeholder="Add someone…"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addAdhocMember()}
              maxLength={25}
            />
            <button
              onClick={addAdhocMember}
              disabled={!newMemberName.trim()}
              className="btn-primary px-4 flex-shrink-0 disabled:opacity-40"
            >
              <UserPlus size={17} />
            </button>
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleNext}
          disabled={!canProceed}
          className="btn-primary w-full text-base shadow-md shadow-indigo-200"
        >
          Add Items <ArrowRight size={18} />
        </motion.button>
      </div>

      {ocrData && (
        <OcrReviewModal
          ocrData={ocrData}
          onConfirm={handleOcrConfirm}
          onCancel={handleOcrCancel}
        />
      )}
    </div>
  )
}
