import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Trash2, AlertTriangle, UserPlus, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { generateId } from '../utils/math'
import { useCurrency } from '../hooks/useCurrency'
import AmountMicButton from './AmountMicButton'

function PersonalItemCard({ item, members, onChange, onDelete, nameSuspicious }) {
  const { t } = useTranslation()
  const { fmt, symbol } = useCurrency()
  const unitPrice = parseFloat(item.unitPrice) || 0
  const totalQty = Object.values(item.shares).reduce((s, q) => s + q, 0)
  const [addMemberId, setAddMemberId] = useState('')
  const [addQty, setAddQty] = useState('1')

  // People the dictation missed for this dish (e.g. Gemini heard 2 of 3 names) —
  // added here rather than requiring a cancel-and-redo.
  const availableMembers = members.filter((m) => !(m.id in item.shares))

  function setUnitPrice(value) {
    // Once the person confirms/corrects this price (typed or via the mic), it's no
    // longer "uncertain" — stop showing the amber "please check" warning for it.
    onChange({ ...item, unitPrice: value, unitPriceUncertain: false })
  }

  function setShare(memberId, qty) {
    const shares = { ...item.shares }
    if (qty <= 0) delete shares[memberId]
    else shares[memberId] = qty
    onChange({ ...item, shares })
  }

  function addMemberShare() {
    if (!addMemberId) return
    setShare(addMemberId, Math.max(1, parseInt(addQty) || 1))
    setAddMemberId('')
    setAddQty('1')
  }

  return (
    <div className="border border-gray-100 rounded-xl p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={item.name}
          onChange={(e) => onChange({ ...item, name: e.target.value })}
          className={`flex-1 min-w-0 border rounded-lg px-2 py-1.5 text-sm font-medium focus:outline-none focus:border-indigo-400 ${nameSuspicious ? 'border-amber-300 bg-amber-50' : 'border-gray-200'}`}
        />
        <div className="flex flex-col items-end flex-shrink-0">
          <div className="flex items-center gap-1">
            <div className={`flex items-center border rounded-lg overflow-hidden ${item.unitPriceUncertain ? 'border-amber-300 bg-amber-50' : 'border-gray-200'}`}>
              <span className="pl-2 text-gray-400 text-xs whitespace-nowrap">{symbol}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={item.unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className="w-20 px-1 py-1.5 text-sm focus:outline-none bg-transparent"
              />
            </div>
            <AmountMicButton onResult={(amount) => setUnitPrice(amount.toString())} />
          </div>
          <span className="text-[10px] text-gray-400 mt-0.5">{t('voiceReview.perUnitPrice')}</span>
        </div>
        <button onClick={onDelete} className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors flex-shrink-0">
          <Trash2 size={14} />
        </button>
      </div>
      {item.unitPriceUncertain && (
        <p className="text-[11px] text-amber-600 flex items-center gap-1 -mt-1">
          <AlertTriangle size={11} /> {unitPrice > 0 ? t('voiceReview.priceUncertain') : t('voiceReview.priceUnknown')}
        </p>
      )}
      {nameSuspicious && (
        <p className="text-[11px] text-amber-600 flex items-center gap-1 -mt-1">
          <AlertTriangle size={11} /> {t('voiceReview.itemNameWarningShort')}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(item.shares).map(([memberId, qty]) => {
          const member = members.find((m) => m.id === memberId)
          return (
            <div key={memberId} className="flex items-center gap-1 bg-indigo-50 rounded-lg px-2 py-1">
              <span className="text-xs text-indigo-700 font-medium truncate max-w-[80px]">{member?.name || '?'}</span>
              <input
                type="number"
                min="0"
                value={qty}
                onChange={(e) => setShare(memberId, Math.max(0, parseInt(e.target.value) || 0))}
                className="w-10 text-xs text-center bg-white rounded border border-indigo-200 py-0.5"
              />
              <button onClick={() => setShare(memberId, 0)} className="text-indigo-300 hover:text-red-400">
                <X size={12} />
              </button>
            </div>
          )
        })}
      </div>
      {availableMembers.length > 0 && (
        <div className="flex items-center gap-1.5">
          <select
            value={addMemberId}
            onChange={(e) => setAddMemberId(e.target.value)}
            className="flex-1 min-w-0 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-indigo-400"
          >
            <option value="">{t('voiceReview.addPersonToItem')}</option>
            {availableMembers.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <input
            type="number"
            min="1"
            value={addQty}
            onChange={(e) => setAddQty(e.target.value)}
            className="w-12 text-xs text-center border border-gray-200 rounded-lg py-1.5 flex-shrink-0"
          />
          <button
            onClick={addMemberShare}
            disabled={!addMemberId}
            className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center disabled:opacity-40 flex-shrink-0"
          >
            <Plus size={14} />
          </button>
        </div>
      )}
      <p className="text-xs text-gray-400 text-right">{t('voiceReview.itemLineTotal', { amount: fmt(unitPrice * totalQty) })}</p>
    </div>
  )
}

function SharedItemRow({ item, onChange, onDelete, nameSuspicious }) {
  const { t } = useTranslation()
  const { fmt, symbol } = useCurrency()
  const totalPrice = parseFloat(item.unitPrice) * (parseInt(item.quantity) || 1) || 0

  return (
    <div className="flex flex-col gap-1.5 py-2 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-2">
        <input
          type="number"
          min="1"
          value={item.quantity}
          onChange={(e) => onChange({ ...item, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
          className="w-12 flex-shrink-0 text-center border border-gray-200 rounded-lg py-1.5 text-sm font-semibold focus:outline-none focus:border-indigo-400"
        />
        <input
          type="text"
          value={item.name}
          onChange={(e) => onChange({ ...item, name: e.target.value })}
          className={`flex-1 min-w-0 border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400 ${nameSuspicious ? 'border-amber-300 bg-amber-50' : 'border-gray-200'}`}
        />
        <button onClick={onDelete} className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors flex-shrink-0">
          <Trash2 size={14} />
        </button>
      </div>
      {nameSuspicious && (
        <p className="text-[11px] text-amber-600 flex items-center gap-1 -mt-1">
          <AlertTriangle size={11} /> {t('voiceReview.itemNameWarningShort')}
        </p>
      )}
      <div className="flex items-center justify-end gap-2">
        <div className="flex items-center flex-shrink-0 border border-gray-200 rounded-lg overflow-hidden">
          <span className="pl-2 text-gray-400 text-xs whitespace-nowrap">{symbol}</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={item.unitPrice}
            onChange={(e) => onChange({ ...item, unitPrice: e.target.value })}
            className="w-20 px-1 py-1.5 text-sm focus:outline-none bg-transparent"
          />
        </div>
        <span className="text-xs text-gray-400 flex-shrink-0">{fmt(totalPrice)}</span>
      </div>
    </div>
  )
}

export default function VoiceBillReviewModal({ voiceData, onConfirm, onCancel }) {
  const { t } = useTranslation()
  const { fmt, symbol } = useCurrency()

  const [members, setMembers] = useState(voiceData.members || [])
  const [items, setItems] = useState(
    (voiceData.items || []).map((i) => ({ ...i, unitPrice: i.unitPrice?.toString() ?? '' }))
  )
  const [grandTotal, setGrandTotal] = useState(voiceData.grandTotal?.toString() || '')
  const [tipAmount, setTipAmount] = useState(voiceData.tipAmount?.toString() || '')
  const [tipPercent, setTipPercent] = useState(voiceData.tipPercent?.toString() || '')
  const [discountAmount, setDiscountAmount] = useState(voiceData.discountAmount?.toString() || '')
  const [newMemberName, setNewMemberName] = useState('')

  const personalItems = items.filter((i) => !i.everyone)
  const sharedItems = items.filter((i) => i.everyone)

  const itemsTotal = items.reduce((sum, i) => {
    const unitPrice = parseFloat(i.unitPrice) || 0
    const qty = i.everyone ? (parseInt(i.quantity) || 1) : Object.values(i.shares).reduce((s, q) => s + q, 0)
    return sum + unitPrice * qty
  }, 0)
  const grandNum = parseFloat(grandTotal) || 0
  const tipAmountNum = parseFloat(tipAmount) || 0
  const tipPercentNum = parseFloat(tipPercent) || 0
  // Tip may be a flat amount or a percentage of the subtotal — when only a
  // percentage was given, convert it against the current items total so the
  // mismatch check and "fill in the missing total" logic below both account
  // for it instead of silently treating a percent-only tip as zero.
  const effectiveTip = tipAmountNum > 0 ? tipAmountNum : tipPercentNum > 0 ? (itemsTotal * tipPercentNum) / 100 : 0
  const foodBudget = grandNum - effectiveTip + (parseFloat(discountAmount) || 0)
  const showMismatch = grandNum > 0 && Math.abs(itemsTotal - foodBudget) > 0.5

  const unresolvedNames = new Set(voiceData.warnings || [])
  const itemNameWarnings = new Set(voiceData.itemNameWarnings || [])

  // If the grand total itself was never said (or the user cleared it), but every
  // item's price is now known (dictated, backend-inferred, or hand-fixed), work it
  // out the same way a person would: items + tip - discount. Stops re-computing the
  // moment the field has any value, so it never fights something the user typed.
  useEffect(() => {
    if (grandTotal !== '') return
    if (items.length === 0) return
    if (items.some((i) => i.unitPriceUncertain)) return
    const computed = itemsTotal + effectiveTip - (parseFloat(discountAmount) || 0)
    if (computed > 0) setGrandTotal(computed.toFixed(2))
  }, [grandTotal, items, itemsTotal, effectiveTip, discountAmount])

  // The mirror case: grand total is now known (typed, or via the mic) but exactly
  // one item's price still isn't — solve for that one item the same way the backend
  // does at dictation time (§ normalizeBillVoice), just live so filling in the total
  // here also finishes the job.
  useEffect(() => {
    if (!grandNum) return
    const unresolved = items.filter((i) => i.unitPriceUncertain || (parseFloat(i.unitPrice) || 0) <= 0)
    if (unresolved.length !== 1) return

    const target = unresolved[0]
    const knownItemsTotal = items
      .filter((i) => i.id !== target.id)
      .reduce((sum, i) => {
        const unitPrice = parseFloat(i.unitPrice) || 0
        const qty = i.everyone ? (parseInt(i.quantity) || 1) : Object.values(i.shares).reduce((s, q) => s + q, 0)
        return sum + unitPrice * qty
      }, 0)
    const targetQty = target.everyone ? (parseInt(target.quantity) || 1) : Object.values(target.shares).reduce((s, q) => s + q, 0)
    const discountNum = parseFloat(discountAmount) || 0
    // A percentage tip is a share of the subtotal we're solving for (it still
    // includes the target's own unknown price), so it must be divided out
    // algebraically rather than subtracted like a flat amount — mirrors the
    // backend's applyPriceInference. Using effectiveTip/itemsTotal here would
    // be circular since the target's price isn't known yet.
    const subtotal =
      tipAmountNum > 0
        ? grandNum - tipAmountNum + discountNum
        : tipPercentNum > 0
          ? (grandNum + discountNum) / (1 + tipPercentNum / 100)
          : grandNum + discountNum
    const remaining = subtotal - knownItemsTotal

    if (remaining > 0 && targetQty > 0) {
      const computedPrice = remaining / targetQty
      // Guard against re-triggering itself: only write when the value actually moves.
      if (Math.abs((parseFloat(target.unitPrice) || 0) - computedPrice) > 0.01) {
        updateItem(target.id, { ...target, unitPrice: computedPrice.toFixed(2), unitPriceUncertain: true })
      }
    }
  }, [grandNum, tipAmountNum, tipPercentNum, discountAmount, items])

  function updateItem(id, updated) {
    setItems((prev) => prev.map((i) => (i.id === id ? updated : i)))
  }

  function deleteItem(id) {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  function updateMemberName(id, name) {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, name } : m)))
  }

  function removeMember(id) {
    setMembers((prev) => prev.filter((m) => m.id !== id))
  }

  function addMember() {
    const name = newMemberName.trim()
    if (!name) return
    setMembers((prev) => [...prev, { id: generateId(), name, isMe: false }])
    setNewMemberName('')
  }

  function handleConfirm() {
    const cleanMembers = members.filter((m) => m.name.trim())

    const cleanItems = items
      .map((i) => {
        const unitPrice = parseFloat(i.unitPrice) || 0
        if (i.everyone) {
          const quantity = Math.max(1, parseInt(i.quantity) || 1)
          return { id: i.id, name: i.name.trim(), unitPrice, quantity, price: unitPrice * quantity, shares: {}, everyone: true }
        }
        const quantity = Object.values(i.shares).reduce((s, q) => s + q, 0)
        return { id: i.id, name: i.name.trim(), unitPrice, quantity, price: unitPrice * quantity, shares: i.shares }
      })
      .filter((i) => i.name && i.unitPrice > 0 && i.quantity > 0)

    onConfirm({
      members: cleanMembers,
      items: cleanItems,
      grandTotal: grandNum,
      tipAmount: parseFloat(tipAmount) || 0,
      tipPercent: tipPercent ? parseFloat(tipPercent) : null,
      discountAmount: parseFloat(discountAmount) || 0,
    })
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onCancel()}
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-white rounded-2xl w-full max-w-md sm:max-w-lg lg:max-w-2xl max-h-[85vh] flex flex-col shadow-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
            <div>
              <h2 className="text-base font-bold">{t('voiceReview.title')}</h2>
              <p className="text-xs text-gray-400 mt-0.5">{t('voiceReview.subtitle')}</p>
            </div>
            <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
              <X size={16} />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-4">
            {unresolvedNames.size > 0 && (
              <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                <AlertTriangle size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700">
                  {t('voiceReview.unresolvedNameWarning', { names: [...unresolvedNames].join(', ') })}
                </p>
              </div>
            )}

            {itemNameWarnings.size > 0 && (
              <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                <AlertTriangle size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700">
                  {t('voiceReview.itemNameWarning', { names: [...itemNameWarnings].join(', ') })}
                </p>
              </div>
            )}

            {/* Members */}
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                {t('voiceReview.membersHeader')}
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {members.map((m) => (
                  <div key={m.id} className={`flex items-center gap-1 rounded-lg px-2 py-1 ${unresolvedNames.has(m.name) ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'}`}>
                    <input
                      type="text"
                      value={m.name}
                      onChange={(e) => updateMemberName(m.id, e.target.value)}
                      maxLength={25}
                      className="w-20 text-xs font-medium bg-transparent outline-none"
                    />
                    {!m.isMe && (
                      <button onClick={() => removeMember(m.id)} className="text-gray-300 hover:text-red-400">
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addMember()}
                  placeholder={t('voiceReview.addMissingMember')}
                  maxLength={25}
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-400"
                />
                <button onClick={addMember} disabled={!newMemberName.trim()} className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center disabled:opacity-40 flex-shrink-0">
                  <UserPlus size={14} />
                </button>
              </div>
            </div>

            {/* Personal items */}
            {personalItems.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                  {t('voiceReview.personalItemsHeader')}
                </label>
                <div className="flex flex-col gap-2">
                  {personalItems.map((item) => (
                    <PersonalItemCard
                      key={item.id}
                      item={item}
                      members={members}
                      onChange={(updated) => updateItem(item.id, updated)}
                      onDelete={() => deleteItem(item.id)}
                      nameSuspicious={itemNameWarnings.has(item.name)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Shared items */}
            {sharedItems.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                  {t('voiceReview.sharedItemsHeader')}
                </label>
                <div className="border border-gray-100 rounded-xl px-3 py-1">
                  {sharedItems.map((item) => (
                    <SharedItemRow
                      key={item.id}
                      item={item}
                      onChange={(updated) => updateItem(item.id, updated)}
                      onDelete={() => deleteItem(item.id)}
                      nameSuspicious={itemNameWarnings.has(item.name)}
                    />
                  ))}
                </div>
              </div>
            )}

            {showMismatch && (
              <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                <AlertTriangle size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700">
                  {t('voiceReview.mismatchWarning', { itemsTotal: fmt(itemsTotal), foodBudget: fmt(foodBudget) })}
                </p>
              </div>
            )}

            {/* Totals */}
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">{t('ocrReview.grandTotal')}</label>
              <div className="flex items-center gap-1.5">
                <div className={`flex-1 flex items-center border-2 rounded-xl ${!grandTotal ? 'border-amber-400 bg-amber-50' : 'border-gray-200'} focus-within:border-indigo-500 focus-within:bg-white transition-colors`}>
                  <span className="pl-4 text-gray-400 font-medium whitespace-nowrap">{symbol}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={grandTotal}
                    onChange={(e) => setGrandTotal(e.target.value)}
                    className="flex-1 px-2 py-3 text-sm bg-transparent outline-none font-semibold"
                  />
                </div>
                <AmountMicButton onResult={(amount) => setGrandTotal(amount.toString())} />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">{t('ocrReview.tip')}</label>
              <div className="flex gap-2">
                <div className="flex items-center border border-gray-200 rounded-xl flex-1 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent">
                  <span className="pl-3 text-gray-400 text-xs font-medium whitespace-nowrap">{symbol}</span>
                  <input
                    type="number" inputMode="decimal" placeholder="0.00" min="0" step="0.01"
                    value={tipAmount}
                    onChange={(e) => setTipAmount(e.target.value)}
                    className="flex-1 px-2 py-2.5 text-sm bg-transparent outline-none"
                  />
                </div>
                <div className="flex items-center border border-gray-200 rounded-xl flex-1 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent">
                  <input
                    type="number" inputMode="decimal" placeholder="0" min="0" max="100"
                    value={tipPercent}
                    onChange={(e) => setTipPercent(e.target.value)}
                    className="flex-1 px-3 py-2.5 text-sm bg-transparent outline-none"
                  />
                  <span className="pr-3 text-gray-400 text-xs font-medium">%</span>
                </div>
              </div>
            </div>

            {voiceData.discountAmount > 0 && (
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">{t('ocrReview.discount')}</label>
                <div className="flex items-center border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-red-400 focus-within:border-transparent">
                  <span className="pl-4 text-red-400 font-medium whitespace-nowrap">-{symbol}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    className="flex-1 px-2 py-3 text-sm bg-transparent outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-5 py-4 border-t border-gray-100">
            <button
              onClick={onCancel}
              className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {t('voiceReview.cancel')}
            </button>
            <button
              onClick={handleConfirm}
              disabled={!grandNum || members.filter((m) => m.name.trim()).length === 0}
              className="flex-1 py-3 rounded-xl bg-indigo-500 text-white text-sm font-semibold disabled:opacity-40 hover:bg-indigo-600 transition-colors"
            >
              {t('voiceReview.confirm')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
