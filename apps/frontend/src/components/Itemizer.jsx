import React, { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { ArrowLeft, Plus, Copy, Check, RotateCcw, RefreshCw, HandCoins } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { generateId, getItemShares } from '../utils/math'
import { getRemainingUnits, isItemComplete } from '../utils/itemizerState'
import { useCurrency } from '../hooks/useCurrency'
import { useBillSummary } from '../hooks/useBillSummary'
import { copyText } from '../utils/clipboard'
import MemberCard from './MemberCard'
import ItemChip, { ItemChipPreview } from './ItemChip'
import ItemDetailSheet from './ItemDetailSheet'

const EVERYONE_ID = 'everyone'

export default function Itemizer({ bill, onBack, onNext, onChange, onReset, onSettleUp, onNewWithSameCrew }) {
  const { t } = useTranslation()
  const { fmt, symbol } = useCurrency()
  const [copied, setCopied] = useState(false)
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
  const [newQty, setNewQty] = useState('')
  const nameRef = useRef(null)
  const qtyRef = useRef(null)
  const priceRef = useRef(null)

  const [activeDragItemId, setActiveDragItemId] = useState(null)
  const [pendingStepper, setPendingStepper] = useState(null) // { itemId, memberId, itemName, max }
  const [editingItemId, setEditingItemId] = useState(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  // Resolve active persons from bill
  const activePersons = (() => {
    const allMembers = bill._adhocMembers || []
    return allMembers.filter((m) => bill.activeMembers.includes(m.id))
  })()

  const itemsTotal = items.reduce((s, i) => s + i.price, 0)
  const foodBudget = (bill.grandTotal || 0) - (bill.tipAmount || 0) + (bill.discountAmount || 0)
  const remaining = Math.round((foodBudget - itemsTotal) * 100) / 100
  const isBalanced = Math.abs(remaining) < 0.005
  const progressPct = foodBudget > 0 ? Math.min((itemsTotal / foodBudget) * 100, 100) : 0

  const allAssigned = items.length > 0 && items.every(isItemComplete)
  const activeDragItem = activeDragItemId ? items.find((i) => i.id === activeDragItemId) : null
  const editingItem = editingItemId ? items.find((i) => i.id === editingItemId) : null

  function updateItem(updated) {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  function addItem() {
    const name = newName.trim()
    const price = parseFloat(newPrice) || 0
    const quantity = Math.max(1, parseInt(newQty) || 1)
    const newItem = {
      id: generateId(),
      name,
      price,
      quantity,
      unitPrice: price / quantity,
      shares: {},
    }
    setItems((prev) => [...prev, newItem])
    setNewName('')
    setNewPrice('')
    setNewQty('')
    nameRef.current?.focus()
  }

  function handleDragStart(event) {
    setActiveDragItemId(event.active.id)
  }

  function handleDragEnd(event) {
    setActiveDragItemId(null)
    const { active, over } = event
    if (!over) return
    const item = items.find((i) => i.id === active.id)
    if (!item) return

    if (over.id === EVERYONE_ID) {
      updateItem({ ...item, shares: {}, everyone: true })
      return
    }

    const remainingUnits = getRemainingUnits(item)
    if (remainingUnits <= 0) return
    const member = activePersons.find((m) => m.id === over.id)
    if (!member) return

    if (remainingUnits === 1) {
      assignQuantity(item.id, member.id, 1)
      return
    }
    setPendingStepper({ itemId: item.id, memberId: member.id, itemName: item.name, max: remainingUnits })
  }

  function assignQuantity(itemId, memberId, qty) {
    const item = items.find((i) => i.id === itemId)
    if (!item) return
    const shares = { ...getItemShares(item) }
    shares[memberId] = (shares[memberId] || 0) + qty
    updateItem({ ...item, shares, everyone: false })
  }

  function commitStepper(qty) {
    if (!pendingStepper) return
    assignQuantity(pendingStepper.itemId, pendingStepper.memberId, qty)
    setPendingStepper(null)
  }

  function removeAssignment(itemId, memberId) {
    const item = items.find((i) => i.id === itemId)
    if (!item) return
    if (memberId === EVERYONE_ID) {
      updateItem({ ...item, everyone: false, shares: {} })
      return
    }
    const shares = { ...getItemShares(item) }
    delete shares[memberId]
    updateItem({ ...item, shares })
  }

  // Live final split (tip/discount-adjusted)
  const summary = useBillSummary({ ...bill, items })

  useEffect(() => {
    if (allAssigned && isBalanced) {
      const updatedBill = { ...bill, items }
      onChange(updatedBill)
      onNext(updatedBill)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allAssigned, isBalanced, items])

  async function copySummary() {
    await copyText(summary.buildTextSummary())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col min-h-screen pb-8 bg-canvas">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-3">
        <button onClick={() => onBack({ ...bill, items })} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold flex-1 text-ink">{t('itemizer.title')}</h1>
      </div>

      {/* Progress bar */}
      <div className="px-5 mb-3.5">
        <div className="bg-white border border-line rounded-[14px] p-3.5 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-ink-muted">{isBalanced ? t('itemizer.allAssigned') : t('itemizer.assigned')}</span>
            <span className={`text-[11px] font-bold ${isBalanced ? 'text-success' : remaining < 0 ? 'text-red-500' : 'text-ink-muted'}`}>
              {isBalanced ? t('itemizer.balanced') : remaining < 0 ? t('itemizer.overBy', { amount: fmt(Math.abs(remaining)) }) : t('itemizer.leftAmount', { amount: fmt(remaining) })}
            </span>
          </div>
          <div className="h-[7px] bg-canvas-track rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${isBalanced ? 'bg-success' : remaining < 0 ? 'bg-red-400' : 'bg-accent'}`}
              style={{ width: `${progressPct}%` }}
              layout
            />
          </div>
          <div className="flex justify-between mt-0.5">
            <span className="text-[11px] text-ink-muted">{t('itemizer.itemsTotal', { amount: fmt(itemsTotal) })}</span>
            <span className="text-[11px] text-ink-muted">{t('itemizer.foodBudget', { amount: fmt(foodBudget) })}</span>
          </div>
        </div>
      </div>

      {/* Two-column body */}
      <div className="px-5 flex-1">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-2.5 items-start">
            <div className="flex-1 min-w-0 flex flex-col gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-muted -mb-1">{t('itemizer.members')}</p>
              {activePersons.map((member) => (
                <MemberCard
                  key={member.id}
                  member={member}
                  isEveryone={false}
                  items={items}
                  pendingStepper={pendingStepper}
                  activeDragItem={!!activeDragItem}
                  onCommitStepper={commitStepper}
                  onCancelStepper={() => setPendingStepper(null)}
                  onRemoveAssignment={(itemId) => removeAssignment(itemId, member.id)}
                />
              ))}
              {activePersons.length > 1 && (
                <MemberCard
                  member={{ id: EVERYONE_ID, name: t('itemizer.everyone') }}
                  isEveryone
                  items={items}
                  pendingStepper={pendingStepper}
                  activeDragItem={!!activeDragItem}
                  onCommitStepper={commitStepper}
                  onCancelStepper={() => setPendingStepper(null)}
                  onRemoveAssignment={(itemId) => removeAssignment(itemId, EVERYONE_ID)}
                />
              )}
            </div>

            <div className="flex-1 min-w-0 flex flex-col gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-muted -mb-1">{t('itemizer.itemsHeader')}</p>
              {items.map((item) => (
                <ItemChip key={item.id} item={item} onTap={() => setEditingItemId(item.id)} />
              ))}
              {items.length === 0 && (
                <p className="text-center text-sm text-gray-300 py-4">{t('itemizer.addItemsBelow')}</p>
              )}
            </div>
          </div>

          <DragOverlay dropAnimation={null}>
            {activeDragItem ? <ItemChipPreview item={activeDragItem} /> : null}
          </DragOverlay>
        </DndContext>

        {/* Add item form */}
        <div className="card p-3 mt-3">
          <input
            ref={nameRef}
            className="w-full text-sm bg-transparent outline-none placeholder-gray-300 text-gray-800 mb-2 pb-2 border-b border-gray-100"
            placeholder={t('itemizer.itemNamePlaceholder')}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            enterKeyHint="next"
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              e.preventDefault()
              qtyRef.current?.focus()
            }}
          />
          <div className="flex gap-2 items-end">
            <div className="flex-shrink-0 w-16">
              <p className="text-[10px] text-gray-400 mb-0.5 text-center">{t('itemizer.qty')}</p>
              <input
                ref={qtyRef}
                className="w-full text-sm font-semibold bg-gray-50 rounded-lg px-2 py-1.5 border border-gray-100 text-center outline-none focus:ring-2 focus:ring-indigo-400"
                type="number"
                inputMode="numeric"
                value={newQty}
                onChange={(e) => setNewQty(e.target.value)}
                enterKeyHint="next"
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  priceRef.current?.focus()
                }}
                min="1"
                step="1"
              />
            </div>
            <div className="flex-shrink-0 w-24">
              <p className="text-[10px] text-gray-400 mb-0.5 text-right pr-0.5">{t('itemizer.totalPrice')}</p>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm whitespace-nowrap">{symbol}</span>
                <input
                  ref={priceRef}
                  className="w-full text-sm font-semibold bg-gray-50 rounded-lg pl-11 pr-2 py-1.5 border border-gray-100 text-right outline-none focus:ring-2 focus:ring-indigo-400"
                  type="number"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  enterKeyHint="done"
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    e.preventDefault()
                    addItem()
                  }}
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={addItem}
              className="w-9 h-9 rounded-xl bg-accent text-white flex items-center justify-center flex-shrink-0 disabled:opacity-40"
              disabled={!newPrice}
            >
              <Plus size={18} />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Live Split */}
      <div className="px-5 mt-4">
        <div className="card p-3.5 flex flex-col gap-2.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">{t('itemizer.liveSplit')}</p>
          <div className="flex flex-col gap-2">
            {summary.results.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-800 font-medium truncate">{r.name}{r.isMe ? t('common.you') : ''}</span>
                <span className="font-bold text-accent flex-shrink-0">{fmt(r.finalTotal)}</span>
              </div>
            ))}
          </div>

          {allAssigned && isBalanced ? (
            <>
              <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium ${summary.sumCheck ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                <span>{summary.sumCheck ? '✓' : '⚠️'}</span>
                <span>
                  {summary.sumCheck
                    ? t('report.totalsVerified', { sum: fmt(summary.verificationSum), total: fmt(summary.grandTotal) })
                    : t('report.roundingDiff', { amount: fmt(Math.abs(summary.verificationSum - summary.grandTotal)) })}
                </span>
              </div>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={copySummary}
                className={`btn-primary w-full text-base transition-colors ${copied ? 'bg-green-500 hover:bg-green-600' : ''}`}
              >
                {copied ? <><Check size={18} /> {t('report.copied')}</> : <><Copy size={18} /> {t('report.copySummary')}</>}
              </motion.button>
              {onSettleUp && (
                <motion.button whileTap={{ scale: 0.97 }} onClick={onSettleUp} className="btn-secondary w-full text-base">
                  <HandCoins size={18} /> {bill.settleBillId ? t('report.viewSettleStatus') : t('report.settleUp')}
                </motion.button>
              )}
              <div className="grid grid-cols-2 gap-3">
                {bill.crewId && (
                  <motion.button whileTap={{ scale: 0.97 }} onClick={onNewWithSameCrew} className="btn-secondary flex-1">
                    <RefreshCw size={16} /> {t('report.sameCrew')}
                  </motion.button>
                )}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={onReset}
                  className={`btn-secondary ${bill.crewId ? 'flex-1' : 'w-full'}`}
                >
                  <RotateCcw size={16} /> {t('report.home')}
                </motion.button>
              </div>
            </>
          ) : (
            items.length > 0 && (
              <p className="text-center text-[11px] text-ink-muted">{t('itemizer.assignAllToEnable')}</p>
            )
          )}
        </div>
      </div>

      {editingItem && (
        <ItemDetailSheet
          item={editingItem}
          activePersons={activePersons}
          onUpdate={updateItem}
          onRemove={() => removeItem(editingItem.id)}
          onClose={() => setEditingItemId(null)}
        />
      )}
    </div>
  )
}
