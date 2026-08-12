import React, { useEffect, useRef, useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { ArrowLeft, Plus, Check, GripVertical, X, Copy, RotateCcw, RefreshCw, HandCoins } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { generateId, getItemShares } from '../../utils/math'
import { getRemainingUnits, isItemComplete, getUnitPrice, getAssignedUnits, getTotalUnits, getItemState } from '../../utils/itemizerState'
import { useCurrency } from '../../hooks/useCurrency'
import { useBillSummary } from '../../hooks/useBillSummary'
import { copyText } from '../../utils/clipboard'
import QuantityStepper from '../../components/QuantityStepper'

const EVERYONE_ID = 'everyone'

function DesktopMemberCard({ member, isEveryone, items, pendingStepper, activeDragItem, onCommitStepper, onCancelStepper, onRemoveAssignment }) {
  const { t } = useTranslation()
  const { fmt } = useCurrency()
  const { setNodeRef, isOver } = useDroppable({ id: member.id })

  const assignedRows = isEveryone
    ? items.filter((i) => i.everyone === true && Object.keys(getItemShares(i)).length === 0)
    : items.map((i) => ({ item: i, count: getItemShares(i)[member.id] || 0 })).filter((r) => r.count > 0)

  const subtotal = isEveryone
    ? assignedRows.reduce((s, item) => s + item.price, 0)
    : assignedRows.reduce((s, r) => s + getUnitPrice(r.item) * r.count, 0)

  const showStepper = pendingStepper?.memberId === member.id
  const isDropTarget = isOver && activeDragItem
  const isEmpty = assignedRows.length === 0

  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl bg-white p-3.5 flex flex-col gap-2 transition-colors ${
        isDropTarget ? 'border-2 border-desktop-primary bg-desktop-tileHome/40' : isEmpty ? 'border-2 border-dashed border-desktop-cardBorder' : 'border border-desktop-cardBorder'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span className="w-8 h-8 rounded-full bg-desktop-primary text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
          {isEveryone ? '∀' : (member.name || '?').charAt(0).toUpperCase()}
        </span>
        <span className="font-bold text-[13.5px] text-desktop-text flex-1 truncate">{member.name}{member.isMe ? t('common.you') : ''}</span>
        {!isEmpty && <span className="text-[13.5px] font-bold text-desktop-primary flex-shrink-0">{fmt(subtotal)}</span>}
      </div>

      {isEveryone && !isEmpty && (
        <span className="inline-flex items-center text-[11px] font-bold text-desktop-primary bg-desktop-tileHome rounded-full px-2 py-0.5 self-start">
          {t('memberCard.splitEqually')}
        </span>
      )}

      {showStepper && (
        <QuantityStepper
          itemName={pendingStepper.itemName}
          memberName={member.name}
          max={pendingStepper.max}
          onCommit={onCommitStepper}
          onCancel={onCancelStepper}
        />
      )}

      {isEmpty && !showStepper && (
        <p className="text-[12px] text-desktop-textMuted3 italic">
          {isDropTarget ? t('memberCard.releaseHere') : isEveryone ? t('memberCard.splitEquallyItalic') : t('itemizer.dragHint', { name: member.name })}
        </p>
      )}

      {assignedRows.map((row) => {
        const item = isEveryone ? row : row.item
        const label = isEveryone ? item.name : `${item.name} ×${row.count}`
        const amount = isEveryone ? item.price : getUnitPrice(item) * row.count
        return (
          <div key={item.id} className="flex items-center gap-2 bg-desktop-content rounded-lg px-2.5 py-1.5 text-[12px]">
            <span className="flex-1 font-semibold truncate text-desktop-text">{label}</span>
            <span className="font-bold text-desktop-primary flex-shrink-0">{fmt(amount)}</span>
            <button onClick={() => onRemoveAssignment(item.id)} className="text-desktop-textMuted3 flex-shrink-0">
              <X size={12} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

function DesktopItemCard({ item, onTap }) {
  const { t } = useTranslation()
  const { fmt } = useCurrency()
  const state = getItemState(item)
  const disabled = state === 'done' || state === 'everyone'
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id, disabled })
  const assigned = getAssignedUnits(item)
  const total = getTotalUnits(item)
  const style = transform ? { transform: CSS.Translate.toString(transform), touchAction: 'none' } : { touchAction: 'none' }

  if (isDragging) {
    return (
      <div ref={setNodeRef} style={style} className="rounded-xl p-3 flex items-center gap-2 border border-dashed border-desktop-cardBorder bg-white opacity-50">
        <GripVertical size={14} className="text-desktop-textMuted3" />
        <span className="font-semibold text-[13px] text-desktop-textMuted3">{item.name}</span>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onTap}
      className={`relative rounded-xl p-3 flex items-center justify-between gap-2 bg-white cursor-grab ${
        state === 'partial' ? 'border-[1.5px] border-desktop-primary' : 'border border-desktop-cardBorder'
      }`}
    >
      {(state === 'done' || state === 'everyone') && (
        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-desktop-successText text-white flex items-center justify-center">
          <Check size={10} />
        </span>
      )}
      <div className="flex items-center gap-2 min-w-0">
        <GripVertical size={14} className="text-desktop-textMuted3 flex-shrink-0" />
        <span className={`font-semibold text-[13.5px] truncate ${disabled ? 'line-through text-desktop-textMuted3' : 'text-desktop-text'}`}>
          {item.name || t('itemChip.item')}
        </span>
      </div>
      <span className={`text-[12px] font-semibold flex-shrink-0 ${disabled ? 'text-desktop-textMuted3' : 'text-desktop-textMuted'}`}>
        {fmt(item.price)} · {assigned}/{total}
      </span>
    </div>
  )
}

export default function DesktopItemizer({ bill, onBack, onNext, onChange, onReset, onSettleUp, onNewWithSameCrew }) {
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
  const [pendingStepper, setPendingStepper] = useState(null)
  const [editingItemId, setEditingItemId] = useState(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

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

  function updateItem(updated) {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
  }

  function addItem() {
    const name = newName.trim()
    const price = parseFloat(newPrice) || 0
    const quantity = Math.max(1, parseInt(newQty) || 1)
    if (!name || price <= 0) return
    setItems((prev) => [...prev, { id: generateId(), name, price, quantity, unitPrice: price / quantity, shares: {} }])
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

  // Live final split (tip/discount-adjusted) for the sticky summary panel
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
    <div style={{ padding: '40px 44px' }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => onBack({ ...bill, items })} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white transition-colors flex-shrink-0">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-[22px] font-extrabold text-desktop-text">{t('itemizer.title')}</h1>
      </div>

      {/* Progress card */}
      <div className="bg-white border border-desktop-cardBorder rounded-2xl p-4 mb-5 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-bold text-desktop-textMuted3">{isBalanced ? t('itemizer.allAssigned') : t('itemizer.assigned')}</span>
          <span className={`text-[12px] font-bold ${isBalanced ? 'text-desktop-successText' : remaining < 0 ? 'text-red-500' : 'text-desktop-textMuted3'}`}>
            {isBalanced ? t('itemizer.balanced') : remaining < 0 ? t('itemizer.overBy', { amount: fmt(Math.abs(remaining)) }) : t('itemizer.leftAmount', { amount: fmt(remaining) })}
          </span>
        </div>
        <div className="h-2 bg-desktop-content rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-[width] ${isBalanced ? 'bg-desktop-successText' : remaining < 0 ? 'bg-red-400' : 'bg-desktop-primary'}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex justify-between">
          <span className="text-[12px] text-desktop-textMuted3">{t('itemizer.itemsTotal', { amount: fmt(itemsTotal) })}</span>
          <span className="text-[12px] text-desktop-textMuted3">{t('itemizer.foodBudget', { amount: fmt(foodBudget) })}</span>
        </div>
      </div>

      {/* 3-column body */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-[18px] items-start">
          {/* Members */}
          <div className="flex-1 flex flex-col gap-2.5" style={{ minWidth: 280 }}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-desktop-textMuted3">{t('itemizer.members')}</p>
            {activePersons.map((member) => (
              <DesktopMemberCard
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
              <DesktopMemberCard
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

          {/* Items */}
          <div className="flex-1 flex flex-col gap-2.5" style={{ minWidth: 260 }}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-desktop-textMuted3">{t('itemizer.itemsHeader')}</p>
            {items.map((item) => (
              <DesktopItemCard key={item.id} item={item} onTap={() => setEditingItemId(item.id)} />
            ))}
            {items.length === 0 && <p className="text-center text-sm text-desktop-textMuted3 py-4">{t('itemizer.addItemsBelow')}</p>}

            <div className="bg-white border border-desktop-cardBorder rounded-xl p-3 mt-1 flex gap-2 items-end">
              <input
                ref={nameRef}
                className="flex-1 text-sm bg-transparent outline-none placeholder-desktop-placeholder text-desktop-text min-w-0"
                placeholder={t('itemizer.itemNamePlaceholder')}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); qtyRef.current?.focus() } }}
              />
              <div className="flex-shrink-0 w-16">
                <p className="text-[10px] text-desktop-textMuted3 mb-0.5 text-center">{t('itemizer.qty')}</p>
                <input
                  ref={qtyRef}
                  className="w-full text-sm font-semibold bg-desktop-content rounded-lg px-2 py-1.5 border border-desktop-cardBorder text-center outline-none focus:ring-2 focus:ring-desktop-primary/40"
                  type="number"
                  inputMode="numeric"
                  value={newQty}
                  onChange={(e) => setNewQty(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); priceRef.current?.focus() } }}
                  min="1"
                  step="1"
                />
              </div>
              <div className="flex-shrink-0 w-24">
                <p className="text-[10px] text-desktop-textMuted3 mb-0.5 text-right pr-0.5">{t('itemizer.totalPrice')}</p>
                <input
                  ref={priceRef}
                  className="w-full text-sm font-semibold bg-desktop-content rounded-lg px-2 py-1.5 border border-desktop-cardBorder text-right outline-none focus:ring-2 focus:ring-desktop-primary/40"
                  type="number"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem() } }}
                  min="0"
                  step="0.01"
                />
              </div>
              <button
                onClick={addItem}
                disabled={!newPrice}
                className="w-9 h-9 rounded-xl bg-desktop-primary text-white flex items-center justify-center flex-shrink-0 disabled:opacity-40"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>

          {/* Live Split */}
          <div className="flex-shrink-0 sticky top-6" style={{ width: 280 }}>
            <div className="bg-white border border-desktop-cardBorder rounded-2xl p-4 flex flex-col gap-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-desktop-textMuted3">{t('itemizer.liveSplit')}</p>
              <div className="flex flex-col gap-2">
                {summary.results.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-[13px]">
                    <span className="text-desktop-text font-medium truncate">{r.name}{r.isMe ? t('common.you') : ''}</span>
                    <span className="font-bold text-desktop-primary flex-shrink-0">{fmt(r.finalTotal)}</span>
                  </div>
                ))}
              </div>

              {allAssigned && isBalanced ? (
                <>
                  <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-[12px] font-medium ${summary.sumCheck ? 'bg-desktop-successBg text-desktop-successText' : 'bg-red-50 text-red-700'}`}>
                    <span>{summary.sumCheck ? '✓' : '⚠️'}</span>
                    <span>
                      {summary.sumCheck
                        ? t('report.totalsVerified', { sum: fmt(summary.verificationSum), total: fmt(summary.grandTotal) })
                        : t('report.roundingDiff', { amount: fmt(Math.abs(summary.verificationSum - summary.grandTotal)) })}
                    </span>
                  </div>
                  <button
                    onClick={copySummary}
                    className={`w-full rounded-xl text-white font-bold text-sm py-3 flex items-center justify-center gap-2 transition-colors ${copied ? 'bg-desktop-successText' : 'bg-desktop-primary'}`}
                  >
                    {copied ? <><Check size={18} /> {t('report.copied')}</> : <><Copy size={18} /> {t('report.copySummary')}</>}
                  </button>
                  {onSettleUp && (
                    <button
                      onClick={onSettleUp}
                      className="w-full rounded-xl bg-white border border-desktop-cardBorder text-desktop-text font-bold text-sm py-3 flex items-center justify-center gap-2"
                    >
                      <HandCoins size={18} /> {bill.settleBillId ? t('report.viewSettleStatus') : t('report.settleUp')}
                    </button>
                  )}
                  <div className="grid grid-cols-2 gap-2.5">
                    {bill.crewId && (
                      <button onClick={onNewWithSameCrew} className="rounded-xl bg-desktop-chipBg text-desktop-text font-semibold text-sm py-3 flex items-center justify-center gap-2">
                        <RefreshCw size={15} /> {t('report.sameCrew')}
                      </button>
                    )}
                    <button
                      onClick={onReset}
                      className={`rounded-xl bg-desktop-chipBg text-desktop-text font-semibold text-sm py-3 flex items-center justify-center gap-2 ${bill.crewId ? '' : 'col-span-2'}`}
                    >
                      <RotateCcw size={15} /> {t('report.home')}
                    </button>
                  </div>
                </>
              ) : (
                items.length > 0 && (
                  <p className="text-center text-[11px] text-desktop-textMuted3">{t('itemizer.assignAllToEnable')}</p>
                )
              )}
            </div>
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeDragItem ? (
            <div className="rounded-xl p-3 flex items-center justify-between border-[1.5px] border-desktop-primary bg-white w-[220px]" style={{ boxShadow: '0 10px 26px rgba(20,20,40,.22)' }}>
              <div className="flex items-center gap-2 min-w-0">
                <GripVertical size={14} className="text-desktop-textMuted3 flex-shrink-0" />
                <span className="font-semibold text-[13px] truncate text-desktop-text">{activeDragItem.name}</span>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {editingItemId && (
        <DesktopItemEditRow
          item={items.find((i) => i.id === editingItemId)}
          onUpdate={updateItem}
          onRemove={() => setItems((prev) => prev.filter((i) => i.id !== editingItemId))}
          onClose={() => setEditingItemId(null)}
        />
      )}
    </div>
  )
}

function DesktopItemEditRow({ item, onUpdate, onRemove, onClose }) {
  const { t } = useTranslation()
  const { symbol } = useCurrency()
  if (!item) return null
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 w-[360px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-desktop-text">{t('itemDetail.editItem')}</h3>
          <button onClick={onClose} className="text-desktop-textMuted3"><X size={18} /></button>
        </div>
        <div className="flex flex-col gap-3">
          <input
            className="rounded-xl border border-desktop-cardBorder px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-desktop-primary/40"
            value={item.name}
            onChange={(e) => onUpdate({ ...item, name: e.target.value })}
          />
          <div className="flex items-center border border-desktop-cardBorder rounded-xl">
            <span className="pl-3 text-desktop-textMuted3 text-sm">{symbol}</span>
            <input
              className="flex-1 px-2 py-2.5 text-sm outline-none"
              type="number"
              value={item.price}
              onChange={(e) => {
                const price = parseFloat(e.target.value) || 0
                onUpdate({ ...item, price, unitPrice: price / (item.quantity || 1) })
              }}
            />
          </div>
          <div className="flex gap-2 mt-1">
            <button onClick={onRemove} className="flex-1 rounded-xl bg-red-50 text-red-600 font-semibold text-sm py-2.5">
              {t('billSetup.remove')}
            </button>
            <button onClick={onClose} className="flex-1 rounded-xl bg-desktop-primary text-white font-semibold text-sm py-2.5">
              {t('itemDetail.done')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
