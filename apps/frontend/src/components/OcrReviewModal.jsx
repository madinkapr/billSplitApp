import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Trash2, AlertTriangle } from 'lucide-react'
import { generateId } from '../utils/math'

function ItemRow({ item, onChange, onDelete }) {
  const total = (parseFloat(item.unitPrice) || 0) * (parseInt(item.quantity) || 1)
  const hasError = !item.name.trim() || parseFloat(item.unitPrice) <= 0

  return (
    <div className={`flex items-center gap-2 py-2 border-b border-gray-100 last:border-0 ${hasError ? 'bg-red-50 rounded-xl px-2' : ''}`}>
      <input
        type="number"
        min="1"
        value={item.quantity}
        onChange={(e) => {
          const qty = Math.max(1, parseInt(e.target.value) || 1)
          onChange({ ...item, quantity: qty, price: (parseFloat(item.unitPrice) || 0) * qty })
        }}
        className="w-12 text-center border border-gray-200 rounded-lg py-1.5 text-sm font-semibold focus:outline-none focus:border-indigo-400"
      />
      <input
        type="text"
        value={item.name}
        placeholder="Item name"
        onChange={(e) => onChange({ ...item, name: e.target.value })}
        className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
      />
      <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
        <span className="pl-2 text-gray-400 text-xs">$</span>
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
      <span className="text-xs text-gray-400 w-20 text-right font-medium">${total.toFixed(2)}</span>
      <button
        onClick={onDelete}
        className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

export default function OcrReviewModal({ ocrData, onConfirm, onCancel }) {
  const [grandTotal, setGrandTotal] = useState(ocrData.grandTotal?.toString() || '')
  const [tipAmount, setTipAmount] = useState(ocrData.tipAmount?.toString() || '')
  const [tipPercent, setTipPercent] = useState(ocrData.tipPercent?.toString() || '')
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
      items: validItems,
    })
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onCancel()}
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
            <div>
              <h2 className="text-base font-bold">Review Receipt</h2>
              <p className="text-xs text-gray-400 mt-0.5">Check and edit before confirming</p>
            </div>
            <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
              <X size={16} />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-4">
            {/* Grand Total */}
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Grand Total</label>
              <div className={`flex items-center border-2 rounded-xl ${!grandTotal ? 'border-amber-400 bg-amber-50' : 'border-gray-200'} focus-within:border-indigo-500 focus-within:bg-white transition-colors`}>
                <span className="pl-4 text-gray-400 font-medium">$</span>
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
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <AlertTriangle size={12} /> Total not detected — please enter manually
                </p>
              )}
            </div>

            {/* Tip */}
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Tip</label>
              <div className="flex gap-2">
                <div className="flex items-center border border-gray-200 rounded-xl flex-1 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent">
                  <span className="pl-3 text-gray-400 text-xs font-medium">$</span>
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

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Items ({items.length})
                </label>
                <span className="text-xs text-gray-400">
                  Total: <span className="font-semibold text-gray-600">${itemsTotal.toFixed(2)}</span>
                </span>
              </div>

              {showMismatch && (
                <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-2">
                  <AlertTriangle size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-700">
                    Items total (${itemsTotal.toFixed(2)}) doesn't match receipt subtotal (${subtotalNum.toFixed(2)})
                  </p>
                </div>
              )}

              <div className="border border-gray-100 rounded-xl px-3 py-1">
                {items.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-3">No items detected</p>
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
                className="mt-2 flex items-center gap-1.5 text-xs text-indigo-600 font-semibold hover:text-indigo-700 transition-colors"
              >
                <Plus size={14} /> Add item
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-5 py-4 border-t border-gray-100">
            <button
              onClick={onCancel}
              className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Enter manually
            </button>
            <button
              onClick={handleConfirm}
              disabled={!grandNum}
              className="flex-1 py-3 rounded-xl bg-indigo-500 text-white text-sm font-semibold disabled:opacity-40 hover:bg-indigo-600 transition-colors"
            >
              Confirm
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
