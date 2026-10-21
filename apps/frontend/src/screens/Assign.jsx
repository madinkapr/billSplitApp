import React, { useEffect, useRef, useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { Plus, ArrowRight, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { generateId, getItemShares } from '../utils/math'
import {
  getTotalUnits,
  getAssignedUnits,
  getRemainingUnits,
  isItemComplete,
  applySplitGroup,
  getGroupSelection,
  normalizeGroupItem,
} from '../utils/itemizerState'
import { useCurrency } from '../hooks/useCurrency'
import { useBillSummary } from '../hooks/useBillSummary'
import { useCelebrateWhenDone } from '../hooks/useCelebration'
import Page, { PageHeader, ActionBar, ActionSum } from '../ui/Page'
import Card from '../ui/Card'
import Button from '../ui/Button'
import Avatar from '../ui/Avatar'
import ProgressBar from '../ui/ProgressBar'
import Stepper from '../ui/Stepper'
import MoneyInput from '../ui/MoneyInput'
import ItemDetailSheet from '../components/ItemDetailSheet'
import MemberCard from '../components/MemberCard'
import ItemChip, { ItemChipPreview } from '../components/ItemChip'
import SplitGroupPicker from '../components/SplitGroupPicker'

const fieldClass = 'w-full min-h-[48px] px-3.5 rounded-ctl border border-line-strong bg-surface text-[16px] text-ink placeholder:text-ink-2 focus:outline focus:outline-2 focus:outline-accent focus:border-transparent'

// How much of a dish's price is already covered by portions handed out.
function assignedValue(item) {
  if (isItemComplete(item)) return item.price
  return item.price * Math.min(getAssignedUnits(item) / getTotalUnits(item), 1)
}

function AddDishForm({ onAdd, onClose, autoFocus }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [qty, setQty] = useState('')
  const [price, setPrice] = useState('')
  const nameRef = useRef(null)
  const qtyRef = useRef(null)
  const priceRef = useRef(null)

  function submit() {
    if (!(parseFloat(price) > 0)) return
    const quantity = Math.max(1, parseInt(qty) || 1)
    const p = parseFloat(price) || 0
    onAdd({ id: generateId(), name: name.trim(), price: p, quantity, unitPrice: p / quantity, shares: {} })
    setName('')
    setQty('')
    setPrice('')
    nameRef.current?.focus()
  }

  return (
    <Card aria-labelledby="add-dish-title" className="!gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="add-dish-title" className="text-[16px] font-semibold">{t('assign.addDish')}</h2>
        {onClose && <Button variant="quiet" size="sm" onClick={onClose}>{t('common.cancel')}</Button>}
      </div>
      <label htmlFor="new-dish-name" className="sr-only">{t('assign.dishName')}</label>
      <input
        id="new-dish-name"
        ref={nameRef}
        autoFocus={autoFocus}
        className={fieldClass}
        placeholder={t('itemizer.itemNamePlaceholder')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        enterKeyHint="next"
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          e.preventDefault()
          qtyRef.current?.focus()
        }}
      />
      <div className="grid grid-cols-[88px_1fr_auto] gap-2 items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor="new-dish-qty" className="text-[13px] text-ink-2">{t('itemizer.qty')}</label>
          <input
            id="new-dish-qty"
            ref={qtyRef}
            className={`${fieldClass} num text-center`}
            type="number"
            inputMode="numeric"
            placeholder="1"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
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
        <div className="flex flex-col gap-1 min-w-0">
          <label htmlFor="new-dish-price" className="text-[13px] text-ink-2">{t('itemizer.totalPrice')}</label>
          <MoneyInput
            id="new-dish-price"
            ref={priceRef}
            value={price}
            onChange={setPrice}
            enterKeyHint="done"
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              e.preventDefault()
              submit()
            }}
          />
        </div>
        <Button variant="primary" onClick={submit} disabled={!(parseFloat(price) > 0)} aria-label={t('assign.addDish')} className="!w-12 !px-0">
          <Plus size={20} aria-hidden="true" />
        </Button>
      </div>
    </Card>
  )
}

const EVERYONE_ID = 'everyone'

// Everyone's final amount as dishes get assigned (service and discount included).
function LiveSplit({ results, grandTotal, unassigned, children }) {
  const { t } = useTranslation()
  const { fmt } = useCurrency()
  return (
    <>
      <h2 className="text-[18px] font-semibold">{t('itemizer.liveSplit')}</h2>
      <ul className="flex flex-col gap-3">
        {results.map((r) => (
          <li key={r.id} className="flex items-center gap-2.5 text-[15px]">
            <Avatar size="sm" id={r.id} name={r.name} />
            <span className={`flex-1 min-w-0 truncate ${r.isMe ? 'font-semibold' : ''}`}>{r.isMe ? t('assign.you') : r.name}</span>
            <span className={`num ${r.isMe ? 'font-bold' : ''}`}>{fmt(r.finalTotal)}</span>
          </li>
        ))}
      </ul>
      {unassigned && <p className="text-[14px] text-ink-2">{t('assign.unassignedHint')}</p>}
      <div className="flex justify-between gap-3 border-t border-line pt-3 font-semibold">
        <span>{t('assign.totalWithService')}</span>
        <span className="num">{fmt(grandTotal)}</span>
      </div>
      {children}
    </>
  )
}

// Step 2 of 3: who ate what. Drag a dish onto a person (or onto Everyone); tap a dish to edit it.
export default function Assign({ bill, onBack, onNext }) {
  const { t } = useTranslation()
  const { fmt } = useCurrency()
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
  const [activeDragItemId, setActiveDragItemId] = useState(null)
  const [pendingStepper, setPendingStepper] = useState(null) // { itemId, memberId, itemName, max }
  const [addOpen, setAddOpen] = useState(items.length === 0)
  const [editingItemId, setEditingItemId] = useState(null)
  const [groupPickerItemId, setGroupPickerItemId] = useState(null)

  const activePersons = (bill._adhocMembers || []).filter((m) => bill.activeMembers.includes(m.id))
  const activeIds = activePersons.map((m) => m.id)

  const itemsTotal = items.reduce((s, i) => s + i.price, 0)
  const foodBudget = (bill.grandTotal || 0) - (bill.tipAmount || 0) + (bill.discountAmount || 0)
  const remaining = Math.round((foodBudget - itemsTotal) * 100) / 100
  const isBalanced = Math.abs(remaining) < 0.005
  const allAssigned = items.length > 0 && items.every(isItemComplete)
  const complete = allAssigned && isBalanced

  const toAssign = items.filter((i) => !isItemComplete(i))
  const done = items.filter(isItemComplete)
  const activeDragItem = activeDragItemId ? items.find((i) => i.id === activeDragItemId) : null
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const coveredValue = items.reduce((s, i) => s + assignedValue(i), 0)
  const leftValue = Math.max(itemsTotal - coveredValue, 0)

  const editingItem = editingItemId ? items.find((i) => i.id === editingItemId) : null
  const groupPickerItem = groupPickerItemId ? items.find((i) => i.id === groupPickerItemId) : null

  // Live final split (service/discount-adjusted)
  const summary = useBillSummary({ ...bill, items })
  const me = summary.results.find((r) => r.isMe)

  function updateItem(updated) {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  function handleDragEnd(event) {
    setActiveDragItemId(null)
    const { active, over } = event
    if (!over) return
    const item = items.find((i) => i.id === active.id)
    if (!item) return

    // Dropping on the shared card asks who shares it (everyone pre-checked).
    if (over.id === EVERYONE_ID) {
      setGroupPickerItemId(item.id)
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
    updateItem(normalizeGroupItem({ ...item, shares }))
  }

  function confirmGroup(selectedIds) {
    if (groupPickerItem) updateItem(applySplitGroup(groupPickerItem, selectedIds, activeIds))
    setGroupPickerItemId(null)
  }

  function addItem(newItem) {
    setItems((prev) => [...prev, newItem])
  }

  // Fireworks the moment the last dish is placed and the sums check out.
  useCelebrateWhenDone(complete, bill.id)

  // ...and then straight on to the split. A bill that was already complete when this screen
  // opened (editing a saved one) waits for the "See the split" button instead.
  const wasComplete = useRef(complete)
  useEffect(() => {
    const becameComplete = complete && !wasComplete.current
    wasComplete.current = complete
    if (!becameComplete) return
    const timer = setTimeout(() => onNext({ ...bill, items }), 600)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete])

  const finish = () => onNext({ ...bill, items })

  const blockedLabel = items.length === 0
    ? t('assign.addDishesFirst')
    : !allAssigned
      ? t('assign.dishesLeft', { count: toAssign.length })
      : t('assign.totalsDontMatch')

  const title = bill.crewName || t('report.billSplitFallback')

  return (
    <Page tight>
      <PageHeader
        title={t('assign.title')}
        meta={`${title} · ${t('assign.dishCount', { count: items.length })}`}
        onBack={() => onBack({ ...bill, items })}
        backLabel={t('common.back')}
        actions={
          !addOpen && (
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus size={18} aria-hidden="true" />
              {t('assign.addDish')}
            </Button>
          )
        }
      />
      <Stepper current={2} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_340px] lg:gap-8 lg:items-start">
        <div className="flex flex-col gap-4 min-w-0">
          {items.length > 0 && (
            <Card className="!gap-2 !py-3.5">
              <div className="flex justify-between gap-3 text-[15px] font-semibold">
                <span>{t('assign.dishesDone', { done: done.length, total: items.length })}</span>
                {leftValue > 0.004 ? (
                  <span className="num text-warn">{t('itemizer.leftAmount', { amount: fmt(leftValue) })}</span>
                ) : (
                  allAssigned && (
                    <span className="inline-flex items-center gap-1 text-ok">
                      <Check size={16} strokeWidth={2.4} aria-hidden="true" />
                      {t('itemizer.allAssigned')}
                    </span>
                  )
                )}
              </div>
              <ProgressBar value={itemsTotal > 0 ? (coveredValue / itemsTotal) * 100 : 0} tone={allAssigned ? 'ok' : 'accent'} label={t('itemizer.assigned')} />
              {!isBalanced && (
                <p role="status" className="text-[14px] text-warn">
                  {remaining > 0 ? t('assign.missing', { amount: fmt(remaining) }) : t('assign.over', { amount: fmt(-remaining) })}
                </p>
              )}
            </Card>
          )}

          {addOpen && <AddDishForm onAdd={addItem} onClose={items.length > 0 ? () => setAddOpen(false) : null} autoFocus={items.length > 0} />}

          <DndContext sensors={sensors} onDragStart={(e) => setActiveDragItemId(e.active.id)} onDragEnd={handleDragEnd} onDragCancel={() => setActiveDragItemId(null)}>
            {toAssign.length > 0 && <p className="text-[14px] text-ink-2">{t('assign.dragHint')}</p>}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-4 items-start">
              <section aria-labelledby="members-col" className="flex flex-col gap-2 min-w-0">
                <h2 id="members-col" className="text-[13px] font-semibold uppercase tracking-wide text-ink-2">{t('itemizer.members')}</h2>
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
              </section>

              <section aria-labelledby="items-col" className="flex flex-col gap-2.5 min-w-0">
                <h2 id="items-col" className="text-[13px] font-semibold uppercase tracking-wide text-ink-2">{t('itemizer.itemsHeader')}</h2>
                {[...toAssign, ...done].map((item) => (
                  <ItemChip key={item.id} item={item} onTap={() => setEditingItemId(item.id)} />
                ))}
                {items.length === 0 && <p className="text-[14px] text-ink-2 py-2">{t('assign.addDishesFirst')}</p>}
              </section>
            </div>
            <DragOverlay dropAnimation={null}>{activeDragItem ? <ItemChipPreview item={activeDragItem} /> : null}</DragOverlay>
          </DndContext>

          <Card className="lg:hidden">
            <LiveSplit results={summary.results} grandTotal={bill.grandTotal || 0} unassigned={leftValue > 0.004} />
          </Card>
        </div>

        <Card as="aside" aria-label={t('itemizer.liveSplit')} className="hidden lg:flex lg:sticky lg:top-10">
          <LiveSplit results={summary.results} grandTotal={bill.grandTotal || 0} unassigned={leftValue > 0.004}>
            {complete ? (
              <Button block size="lg" variant="primary" onClick={finish}>
                {t('assign.seeSplit')}
                <ArrowRight size={20} aria-hidden="true" />
              </Button>
            ) : (
              <Button block size="lg" disabled>{blockedLabel}</Button>
            )}
          </LiveSplit>
        </Card>
      </div>

      <ActionBar className="lg:hidden">
        <ActionSum label={me ? t('assign.yourShare') : t('assign.totalWithService')} value={fmt(me ? me.finalTotal : bill.grandTotal || 0)} />
        {complete ? (
          <Button variant="primary" size="lg" className="ml-auto" onClick={finish}>
            {t('assign.seeSplit')}
            <ArrowRight size={20} aria-hidden="true" />
          </Button>
        ) : (
          <Button size="lg" className="ml-auto" disabled>{blockedLabel}</Button>
        )}
      </ActionBar>

      {editingItem && (
        <ItemDetailSheet
          item={editingItem}
          activePersons={activePersons}
          onUpdate={updateItem}
          onRemove={() => removeItem(editingItem.id)}
          onClose={() => setEditingItemId(null)}
          onOpenGroupPicker={() => {
            setEditingItemId(null)
            setGroupPickerItemId(editingItem.id)
          }}
        />
      )}

      {groupPickerItem && (
        <SplitGroupPicker
          item={groupPickerItem}
          persons={activePersons}
          initialSelected={getGroupSelection(groupPickerItem, activeIds)}
          onConfirm={confirmGroup}
          onClose={() => setGroupPickerItemId(null)}
        />
      )}
    </Page>
  )
}
