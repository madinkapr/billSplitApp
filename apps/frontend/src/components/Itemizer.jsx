import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, Plus, Minus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { generateId, fmt, getItemShares } from '../utils/math'

// Unassigned member: a muted chip the user taps to add at qty 1.
function AddChip({ member, onAdd }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onAdd}
      className="px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all whitespace-nowrap bg-gray-100 text-gray-400 border-transparent"
    >
      {member.name}
    </motion.button>
  )
}

// Assigned member: active chip + inline −/+ stepper + resolved $ share.
function AssignedChip({ member, count, share, onInc, onDec }) {
  return (
    <div className="flex items-center gap-2 pl-3 pr-1.5 py-1 rounded-full bg-indigo-500 text-white border-2 border-indigo-500 shadow-sm shadow-indigo-200">
      <span className="text-xs font-semibold whitespace-nowrap">{member.name}</span>
      <div className="flex items-center gap-1.5 bg-indigo-600/60 rounded-full px-1 py-0.5">
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={onDec}
          aria-label="Decrease share"
          className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-indigo-700"
        >
          <Minus size={12} />
        </motion.button>
        <span className="text-xs font-bold w-3 text-center tabular-nums">{count}</span>
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={onInc}
          aria-label="Increase share"
          className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-indigo-700"
        >
          <Plus size={12} />
        </motion.button>
      </div>
      <span className="text-xs font-bold whitespace-nowrap tabular-nums">{fmt(share)}</span>
    </div>
  )
}

function ItemRow({ item, activePersons, onUpdate, onRemove }) {
  const [expanded, setExpanded] = useState(true)

  // Resolve shares against currently-active members only.
  const allShares = getItemShares(item)
  const shares = {}
  activePersons.forEach((p) => { if (allShares[p.id] > 0) shares[p.id] = allShares[p.id] })
  const assignedIds = Object.keys(shares)
  const totalCount = assignedIds.reduce((s, id) => s + shares[id], 0)
  const unassigned = activePersons.filter((p) => !shares[p.id])

  function setShares(next) {
    // Drop zero/negative counts; store as plain object.
    const cleaned = {}
    Object.entries(next).forEach(([id, c]) => { if (c > 0) cleaned[id] = c })
    onUpdate({ ...item, shares: cleaned })
  }

  function addAssignee(id) { setShares({ ...shares, [id]: 1 }) }
  function incAssignee(id) { setShares({ ...shares, [id]: (shares[id] || 0) + 1 }) }

  // "Everyone" assigns all active members at qty 1; tapping again when everyone
  // is already on at qty 1 clears the item back to the split-among-everyone fallback.
  const everyoneEqual =
    activePersons.length > 0 &&
    assignedIds.length === activePersons.length &&
    activePersons.every((p) => shares[p.id] === 1)
  function toggleEveryone() {
    if (everyoneEqual) {
      setShares({})
    } else {
      const next = {}
      activePersons.forEach((p) => { next[p.id] = 1 })
      setShares(next)
    }
  }
  function decAssignee(id) {
    const next = { ...shares }
    if ((next[id] || 0) <= 1) delete next[id]
    else next[id] = next[id] - 1
    setShares(next)
  }

  const allEqual = assignedIds.length > 0 && assignedIds.every((id) => shares[id] === shares[assignedIds[0]])
  const ratioLabel = assignedIds.length === 0
    ? null
    : allEqual
      ? `${fmt(item.price)} split equally`
      : `${fmt(item.price)} split ${assignedIds.map((id) => shares[id]).join(' : ')}`

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
            <div className="px-3 py-2.5 flex flex-col gap-2.5">
              {/* Quick action: assign / clear everyone at once */}
              {activePersons.length > 1 && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={toggleEveryone}
                  className={`self-start px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all whitespace-nowrap ${
                    everyoneEqual
                      ? 'bg-indigo-500 text-white border-indigo-500 shadow-sm shadow-indigo-200'
                      : 'bg-white text-indigo-600 border-indigo-200'
                  }`}
                >
                  {everyoneEqual ? '✓ Everyone' : '+ Everyone'}
                </motion.button>
              )}

              {/* Assigned members: chip + stepper + resolved $ */}
              {assignedIds.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  {assignedIds.map((id) => {
                    const member = activePersons.find((p) => p.id === id)
                    const share = totalCount > 0 ? item.price * (shares[id] / totalCount) : 0
                    return (
                      <AssignedChip
                        key={id}
                        member={member}
                        count={shares[id]}
                        share={share}
                        onInc={() => incAssignee(id)}
                        onDec={() => decAssignee(id)}
                      />
                    )
                  })}
                </div>
              )}

              {/* Unassigned members: tap to add at qty 1 */}
              {unassigned.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {assignedIds.length > 0 && (
                    <span className="text-xs text-gray-300 font-medium mr-0.5">Add:</span>
                  )}
                  {unassigned.map((p) => (
                    <AddChip key={p.id} member={p} onAdd={() => addAssignee(p.id)} />
                  ))}
                </div>
              )}

              {/* Ratio summary / fallback warning */}
              {ratioLabel ? (
                <p className="text-xs text-gray-400">{ratioLabel}</p>
              ) : (
                <p className="text-xs text-amber-500 font-medium bg-amber-50 px-2 py-1 rounded-lg self-start">
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
  const [items, setItems] = useState(() => {
    if (bill.items?.length > 0) return bill.items
    if (bill._ocrItems?.length > 0) {
      return bill._ocrItems.map((i) => ({
        id: generateId(),
        name: i.name,
        price: i.price,
        quantity: i.quantity || 1,
        unitPrice: i.unitPrice || i.price,
        shares: {},
      }))
    }
    return []
  })
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
      shares: {},
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
