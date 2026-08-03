import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Minus, Trash2 } from 'lucide-react'
import { fmt, getItemShares } from '../utils/math'

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
    <div className="flex items-center gap-2 pl-3 pr-1.5 py-1 rounded-full bg-accent text-white border-2 border-accent shadow-sm">
      <span className="text-xs font-semibold whitespace-nowrap">{member.name}</span>
      <div className="flex items-center gap-1.5 bg-black/15 rounded-full px-1 py-0.5">
        <motion.button whileTap={{ scale: 0.85 }} onClick={onDec} aria-label="Decrease share" className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-black/20">
          <Minus size={12} />
        </motion.button>
        <span className="text-xs font-bold w-3 text-center tabular-nums">{count}</span>
        <motion.button whileTap={{ scale: 0.85 }} onClick={onInc} aria-label="Increase share" className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-black/20">
          <Plus size={12} />
        </motion.button>
      </div>
      <span className="text-xs font-bold whitespace-nowrap tabular-nums">{fmt(share)}</span>
    </div>
  )
}

export default function ItemDetailSheet({ item, activePersons, onUpdate, onRemove, onClose }) {
  const allShares = getItemShares(item)
  const shares = {}
  activePersons.forEach((p) => { if (allShares[p.id] > 0) shares[p.id] = allShares[p.id] })
  const assignedIds = Object.keys(shares)
  const totalCount = assignedIds.reduce((s, id) => s + shares[id], 0)
  const unassigned = activePersons.filter((p) => !shares[p.id])

  function setShares(next, everyone = false) {
    const cleaned = {}
    Object.entries(next).forEach(([id, c]) => { if (c > 0) cleaned[id] = c })
    onUpdate({ ...item, shares: cleaned, everyone })
  }

  function addAssignee(id) { setShares({ ...shares, [id]: 1 }) }
  function incAssignee(id) { setShares({ ...shares, [id]: (shares[id] || 0) + 1 }) }
  function decAssignee(id) {
    const next = { ...shares }
    if ((next[id] || 0) <= 1) delete next[id]
    else next[id] = next[id] - 1
    setShares(next)
  }

  const isEveryone = item.everyone === true && assignedIds.length === 0
  function toggleEveryone() { setShares({}, true) }

  const allEqual = assignedIds.length > 0 && assignedIds.every((id) => shares[id] === shares[assignedIds[0]])
  const ratioLabel = assignedIds.length === 0
    ? null
    : allEqual
      ? `${fmt(item.price)} split equally`
      : `${fmt(item.price)} split ${assignedIds.map((id) => shares[id]).join(' : ')}`

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-xl"
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
            <h2 className="text-base font-bold">Edit Item</h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
              <X size={16} />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-4">
            {/* Name / price / quantity */}
            <div className="flex gap-2 items-end">
              <input
                className="flex-1 text-sm font-medium border border-gray-200 rounded-lg px-2 py-2 outline-none focus:ring-2 focus:ring-indigo-400 min-w-0"
                placeholder="Item name…"
                value={item.name}
                onChange={(e) => onUpdate({ ...item, name: e.target.value })}
              />
              <div className="flex-shrink-0 w-24">
                <p className="text-[10px] text-gray-400 mb-0.5 text-right pr-0.5">Umumiy narxi</p>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input
                    className="w-full text-sm font-semibold bg-gray-50 rounded-lg pl-5 pr-2 py-2 border border-gray-100 text-right outline-none focus:ring-2 focus:ring-indigo-400"
                    type="number"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={item.price === 0 ? '' : item.price}
                    onChange={(e) => onUpdate({ ...item, price: parseFloat(e.target.value) || 0 })}
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              <div className="flex-shrink-0 w-16">
                <input
                  className="w-full text-sm font-semibold bg-gray-50 rounded-lg px-2 py-2 border border-gray-100 text-center outline-none focus:ring-2 focus:ring-indigo-400"
                  type="number"
                  inputMode="numeric"
                  placeholder="Qty"
                  value={item.quantity || 1}
                  onChange={(e) => {
                    const qty = Math.max(1, parseInt(e.target.value) || 1)
                    onUpdate({ ...item, quantity: qty, unitPrice: item.price / qty })
                  }}
                  min="1"
                  step="1"
                />
              </div>
            </div>

            {/* Quick action: assign / clear everyone at once */}
            {activePersons.length > 1 && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={toggleEveryone}
                className={`self-start px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all whitespace-nowrap ${
                  isEveryone ? 'bg-accent text-white border-accent shadow-sm' : 'bg-white text-accent border-accent/40'
                }`}
              >
                {isEveryone ? '✓ Everyone' : '+ Everyone'}
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
                {assignedIds.length > 0 && <span className="text-xs text-gray-300 font-medium mr-0.5">Add:</span>}
                {unassigned.map((p) => (
                  <AddChip key={p.id} member={p} onAdd={() => addAssignee(p.id)} />
                ))}
              </div>
            )}

            {ratioLabel ? (
              <p className="text-xs text-gray-400">{ratioLabel}</p>
            ) : (
              <p className="text-xs text-gray-400">{fmt(item.price)} split equally among everyone</p>
            )}
          </div>

          <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
            <button
              onClick={() => { onRemove(); onClose() }}
              className="w-11 h-11 flex items-center justify-center rounded-xl text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors flex-shrink-0"
            >
              <Trash2 size={16} />
            </button>
            <button onClick={onClose} className="btn-primary flex-1 text-sm">
              Done
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
