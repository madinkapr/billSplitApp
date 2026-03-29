import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { generateId, fmt } from '../utils/math'

function Avatar({ member, active, onToggle }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onToggle}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all whitespace-nowrap ${
        active
          ? 'bg-indigo-500 text-white border-indigo-500 shadow-sm shadow-indigo-200'
          : 'bg-gray-100 text-gray-400 border-transparent'
      }`}
    >
      {member.name}
    </motion.button>
  )
}

function ItemRow({ item, activePersons, onUpdate, onRemove }) {
  const [expanded, setExpanded] = useState(true)
  const assignedCount = item.assignees.filter((id) => activePersons.some((p) => p.id === id)).length
  const sharePrice = assignedCount > 0 ? item.price / assignedCount : 0

  function toggleAssignee(id) {
    const next = item.assignees.includes(id)
      ? item.assignees.filter((x) => x !== id)
      : [...item.assignees, id]
    onUpdate({ ...item, assignees: next })
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10, height: 0 }}
      className="card overflow-hidden"
    >
      {/* Item header */}
      <div className="flex items-center gap-2 p-3">
        <input
          className="flex-1 text-sm font-medium bg-transparent border-0 outline-none text-gray-800 placeholder-gray-300 min-w-0"
          placeholder="Item name…"
          value={item.name}
          onChange={(e) => onUpdate({ ...item, name: e.target.value })}
        />
        <div className="relative flex-shrink-0 w-24">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
          <input
            className="w-full text-sm font-semibold bg-gray-50 rounded-lg pl-5 pr-2 py-1.5 border border-gray-100 text-right outline-none focus:ring-2 focus:ring-indigo-400"
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={item.price === 0 ? '' : item.price}
            onChange={(e) => onUpdate({ ...item, price: parseFloat(e.target.value) || 0 })}
            min="0"
            step="0.01"
          />
        </div>
        <button
          onClick={() => setExpanded((p) => !p)}
          className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-gray-500"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        <button
          onClick={onRemove}
          className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* Assignees */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-gray-50"
          >
            <div className="px-3 py-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                {activePersons.map((p) => (
                  <Avatar
                    key={p.id}
                    member={p}
                    active={item.assignees.includes(p.id)}
                    onToggle={() => toggleAssignee(p.id)}
                    size="sm"
                  />
                ))}
              </div>
              {assignedCount > 0 && item.price > 0 && (
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-400">
                    {fmt(item.price)} ÷ {assignedCount}
                  </p>
                  <p className="text-sm font-bold text-indigo-600">{fmt(sharePrice)} ea</p>
                </div>
              )}
              {assignedCount === 0 && (
                <p className="text-xs text-amber-500 font-medium bg-amber-50 px-2 py-1 rounded-lg">
                  ⚠ Split among everyone
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function Itemizer({ bill, onBack, onNext, onChange }) {
  const [items, setItems] = useState(bill.items || [])
  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const nameRef = useRef(null)

  // Resolve active persons from bill
  const activePersons = (() => {
    const allMembers = bill._adhocMembers || []
    return allMembers.filter((m) => bill.activeMembers.includes(m.id))
  })()

  const itemsTotal = items.reduce((s, i) => s + i.price, 0)
  const foodBudget = (bill.grandTotal || 0) - (bill.tipAmount || 0)
  const remaining = Math.round((foodBudget - itemsTotal) * 100) / 100
  const isBalanced = Math.abs(remaining) < 0.005

  function updateItem(updated) {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  function addItem() {
    const name = newName.trim()
    const price = parseFloat(newPrice) || 0
    const newItem = {
      id: generateId(),
      name,
      price,
      assignees: [],
    }
    setItems((prev) => [...prev, newItem])
    setNewName('')
    setNewPrice('')
    nameRef.current?.focus()
  }

  function handleNext() {
    const updatedBill = { ...bill, items }
    onChange(updatedBill)
    onNext(updatedBill)
  }

  const progressPct = foodBudget > 0 ? Math.min((itemsTotal / foodBudget) * 100, 100) : 0

  return (
    <div className="flex flex-col min-h-screen pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-3">
        <button onClick={() => onBack({ ...bill, items })} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold flex-1">Add Items</h1>
      </div>

      {/* Progress bar */}
      <div className="px-5 mb-4">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500">Assigned</span>
            <span className={`text-xs font-bold ${isBalanced ? 'text-green-500' : remaining < 0 ? 'text-red-500' : 'text-gray-500'}`}>
              {isBalanced ? '✓ Balanced' : remaining < 0 ? `Over by ${fmt(Math.abs(remaining))}` : `${fmt(remaining)} left`}
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full transition-all ${isBalanced ? 'bg-green-400' : remaining < 0 ? 'bg-red-400' : 'bg-indigo-400'}`}
              style={{ width: `${progressPct}%` }}
              layout
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-xs text-gray-400">{fmt(itemsTotal)} items</span>
            <span className="text-xs text-gray-400">Food budget: {fmt(foodBudget)}</span>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="px-5 flex flex-col gap-3 flex-1">
        <AnimatePresence mode="popLayout">
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              activePersons={activePersons}
              onUpdate={updateItem}
              onRemove={() => removeItem(item.id)}
            />
          ))}
        </AnimatePresence>

        {/* Add item form */}
        <div className="card p-3">
          <div className="flex gap-2 items-center">
            <input
              ref={nameRef}
              className="flex-1 text-sm bg-transparent outline-none placeholder-gray-300 text-gray-800 min-w-0"
              placeholder="Item name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && newPrice && addItem()}
            />
            <div className="relative flex-shrink-0 w-24">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                className="w-full text-sm font-semibold bg-gray-50 rounded-lg pl-5 pr-2 py-1.5 border border-gray-100 text-right outline-none focus:ring-2 focus:ring-indigo-400"
                type="number"
                inputMode="decimal"
                placeholder="0.00"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addItem()}
                min="0"
                step="0.01"
              />
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={addItem}
              className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 active:bg-indigo-700 disabled:opacity-40"
              disabled={!newPrice}
            >
              <Plus size={18} />
            </motion.button>
          </div>
        </div>

        {items.length === 0 && (
          <p className="text-center text-sm text-gray-300 py-4">Add items from the bill above</p>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 mt-4">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleNext}
          disabled={items.length === 0}
          className="btn-primary w-full text-base shadow-md shadow-indigo-200"
        >
          Calculate Split <ArrowRight size={18} />
        </motion.button>
      </div>
    </div>
  )
}
