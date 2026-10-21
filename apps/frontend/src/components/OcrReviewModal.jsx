import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Trash2, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { generateId } from '../utils/math'
import { useCurrency } from '../hooks/useCurrency'

function ItemRow({ item, onChange, onDelete }) {
  const { t } = useTranslation()
  const { fmt, symbol } = useCurrency()
  const total = (parseFloat(item.unitPrice) || 0) * (parseInt(item.quantity) || 1)
  const hasError = !item.name.trim() || parseFloat(item.unitPrice) <= 0

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 py-2 border-b border-line last:border-0 ${hasError ? 'bg-warn-tint rounded-xl px-2' : ''}`}>
      <div className="flex items-center gap-2 sm:flex-1 sm:min-w-0">
        <input
          type="number"
          min="1"
          value={item.quantity}
          onChange={(e) => {
            const qty = Math.max(1, parseInt(e.target.value) || 1)
            onChange({ ...item, quantity: qty, price: (parseFloat(item.unitPrice) || 0) * qty })
          }}
          className="w-12 flex-shrink-0 text-center border border-line rounded-lg py-1.5 text-sm font-semibold focus:outline-none focus:border-accent"
        />
        <input
          type="text"
          value={item.name}
          placeholder={t('ocrReview.itemNamePlaceholder')}
          onChange={(e) => onChange({ ...item, name: e.target.value })}
          className="flex-1 min-w-0 border border-line rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-accent"
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        <div className="flex items-center flex-shrink-0 border border-line rounded-lg overflow-hidden">
          <span className="pl-2 text-ink-2 text-[13px] whitespace-nowrap">{symbol}</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={item.unitPrice}
            placeholder="0.00"
            onChange={(e) => {
              const up = parseFloat(e.target.value) || 0
              onChange({ ...item, unitPrice: e.target.value, price: up * (parseInt(item.quantity) || 1) })
            }}
            className="w-24 px-1 py-1.5 text-sm focus:outline-none bg-transparent"
          />
        </div>
        <span className="text-[13px] text-ink-2 w-20 flex-shrink-0 text-right font-medium">{fmt(total)}</span>
        <button
          onClick={onDelete}
          aria-label={t('common.delete')}
          className="w-11 h-11 -my-2 rounded-full flex items-center justify-center text-ink-2 hover:text-warn transition-colors flex-shrink-0"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

export default function OcrReviewModal({ ocrData, onConfirm, onCancel }) {
  const { t } = useTranslation()
  const { fmt, symbol } = useCurrency()
  const [grandTotal, setGrandTotal] = useState(ocrData.grandTotal?.toString() || '')
  const [tipAmount, setTipAmount] = useState(ocrData.tipAmount?.toString() || '')
  const [tipPercent, setTipPercent] = useState(ocrData.tipPercent?.toString() || '')
  const [discountAmount, setDiscountAmount] = useState(ocrData.discountAmount?.toString() || '')
  const [items, setItems] = useState(
    (ocrData.items || []).map((i) => ({ ...i, id: generateId(), unitPrice: i.unitPrice?.toString() || i.price?.toString() || '' }))
  )

  const grandNum = parseFloat(grandTotal) || 0
  const subtotalNum = parseFloat(ocrData.subtotal) || 0
  const itemsTotal = items.reduce((sum, i) => sum + (parseFloat(i.unitPrice) || 0) * (parseInt(i.quantity) || 1), 0)
  const showMismatch = subtotalNum > 0 && Math.abs(itemsTotal - subtotalNum) > 0.05

  function updateItem(id, updated) {
    setItems((prev) => prev.map((i) => (i.id === id ? updated : i)))
  }

  function deleteItem(id) {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  function addItem() {
    setItems((prev) => [...prev, { id: generateId(), name: '', unitPrice: '', quantity: 1, price: 0 }])
  }

  function handleConfirm() {
    const validItems = items
      .filter((i) => i.name.trim() && parseFloat(i.unitPrice) > 0)
      .map((i) => ({
        name: i.name.trim(),
        quantity: parseInt(i.quantity) || 1,
        unitPrice: parseFloat(i.unitPrice),
        price: (parseFloat(i.unitPrice) || 0) * (parseInt(i.quantity) || 1),
      }))

    onConfirm({
      grandTotal: grandNum,
      tipAmount: parseFloat(tipAmount) || null,
      tipPercent: parseFloat(tipPercent) || null,
      discountAmount: parseFloat(discountAmount) || null,
      items: validItems,
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
          className="bg-surface rounded-2xl w-full max-w-md sm:max-w-lg lg:max-w-2xl max-h-[85vh] flex flex-col shadow-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-line">
            <div>
              <h2 className="text-base font-bold">{t('ocrReview.title')}</h2>
              <p className="text-[13px] text-ink-2 mt-0.5">{t('ocrReview.subtitle')}</p>
            </div>
            <button onClick={onCancel} aria-label={t('common.close')} className="w-11 h-11 -mr-2 flex items-center justify-center rounded-full hover:bg-surface-2">
              <X size={16} />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-4">
            {/* Grand Total */}
            <div>
              <label className="text-[13px] font-semibold text-ink-2 uppercase tracking-wider block mb-1.5">{t('ocrReview.grandTotal')}</label>
              <div className={`flex items-center border-2 rounded-xl ${!grandTotal ? 'border-warn bg-warn-tint' : 'border-line'} focus-within:border-accent focus-within:bg-surface transition-colors`}>
                <span className="pl-4 text-ink-2 font-medium whitespace-nowrap">{symbol}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={grandTotal}
                  onChange={(e) => setGrandTotal(e.target.value)}
                  className="flex-1 px-2 py-3 text-sm bg-transparent outline-none font-semibold"
                />
              </div>
              {!grandTotal && (
                <p className="text-[13px] text-warn mt-1 flex items-center gap-1">
                  <AlertTriangle size={12} /> {t('ocrReview.totalNotDetected')}
                </p>
              )}
            </div>

            {/* Tip */}
            <div>
              <label className="text-[13px] font-semibold text-ink-2 uppercase tracking-wider block mb-1.5">{t('ocrReview.tip')}</label>
              <div className="flex gap-2">
                <div className="flex items-center border border-line rounded-xl flex-1 focus-within:ring-2 focus-within:ring-accent focus-within:border-transparent">
                  <span className="pl-3 text-ink-2 text-[13px] font-medium whitespace-nowrap">{symbol}</span>
                  <input
                    type="number" inputMode="decimal" placeholder="0.00" min="0" step="0.01"
                    value={tipAmount}
                    onChange={(e) => setTipAmount(e.target.value)}
                    className="flex-1 px-2 py-2.5 text-sm bg-transparent outline-none"
                  />
                </div>
                <div className="flex items-center border border-line rounded-xl flex-1 focus-within:ring-2 focus-within:ring-accent focus-within:border-transparent">
                  <input
                    type="number" inputMode="decimal" placeholder="0" min="0" max="100"
                    value={tipPercent}
                    onChange={(e) => setTipPercent(e.target.value)}
                    className="flex-1 px-3 py-2.5 text-sm bg-transparent outline-none"
                  />
                  <span className="pr-3 text-ink-2 text-[13px] font-medium">%</span>
                </div>
              </div>
            </div>

            {/* Discount — faqat OCR aniqlagan bo'lsa ko'rsatiladi */}
            {ocrData.discountAmount > 0 && (
              <div>
                <label className="text-[13px] font-semibold text-ink-2 uppercase tracking-wider block mb-1.5">{t('ocrReview.discount')}</label>
                <div className="flex items-center border border-line rounded-xl focus-within:ring-2 focus-within:ring-warn focus-within:border-transparent">
                  <span className="pl-4 text-warn font-medium whitespace-nowrap">-{symbol}</span>
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

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[13px] font-semibold text-ink-2 uppercase tracking-wider">
                  {t('ocrReview.itemsCount', { count: items.length })}
                </label>
                <span className="text-[13px] text-ink-2">
                  {t('ocrReview.total', { amount: fmt(itemsTotal) })}
                </span>
              </div>

              {showMismatch && (
                <div className="flex items-start gap-1.5 bg-warn-tint border border-warn rounded-xl px-3 py-2 mb-2">
                  <AlertTriangle size={13} className="text-warn mt-0.5 flex-shrink-0" />
                  <p className="text-[13px] text-warn">
                    {t('ocrReview.mismatchWarning', { itemsTotal: fmt(itemsTotal), subtotal: fmt(subtotalNum) })}
                  </p>
                </div>
              )}

              <div className="border border-line rounded-xl px-3 py-1">
                {items.length === 0 && (
                  <p className="text-[13px] text-ink-2 text-center py-3">{t('ocrReview.noItemsDetected')}</p>
                )}
                {items.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    onChange={(updated) => updateItem(item.id, updated)}
                    onDelete={() => deleteItem(item.id)}
                  />
                ))}
              </div>

              <button
                onClick={addItem}
                className="mt-2 flex items-center gap-1.5 text-[13px] text-link font-semibold hover:text-link transition-colors"
              >
                <Plus size={14} /> {t('ocrReview.addItem')}
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-5 py-4 border-t border-line">
            <button
              onClick={onCancel}
              className="flex-1 py-3 rounded-xl border-2 border-line text-sm font-semibold text-ink-2 hover:bg-surface-2 transition-colors"
            >
              {t('ocrReview.enterManually')}
            </button>
            <button
              onClick={handleConfirm}
              disabled={!grandNum}
              className="flex-1 py-3 rounded-xl bg-accent text-on-accent text-sm font-semibold disabled:opacity-40 hover:bg-accent transition-colors"
            >
              {t('ocrReview.confirm')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
