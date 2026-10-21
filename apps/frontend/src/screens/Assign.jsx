import React, { useEffect, useRef, useState } from 'react'
import { Plus, Minus, ArrowRight, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { generateId, getItemShares } from '../utils/math'
import {
  getTotalUnits,
  getAssignedUnits,
  getItemState,
  isItemComplete,
  applySplitGroup,
  getGroupSelection,
  normalizeGroupItem,
} from '../utils/itemizerState'
import { useCurrency } from '../hooks/useCurrency'
import { useBillSummary } from '../hooks/useBillSummary'
import { useCelebrateWhenDone } from '../hooks/useCelebration'
import Page, { PageHeader, ActionBar, ActionSum } from '../ui/Page'
import Card, { List } from '../ui/Card'
import Button from '../ui/Button'
import Avatar, { AvatarStack } from '../ui/Avatar'
import StatusPill from '../ui/StatusPill'
import ProgressBar from '../ui/ProgressBar'
import Stepper from '../ui/Stepper'
import MoneyInput from '../ui/MoneyInput'
import ItemDetailSheet from '../components/ItemDetailSheet'
import SplitGroupPicker from '../components/SplitGroupPicker'

const fieldClass = 'w-full min-h-[48px] px-3.5 rounded-ctl border border-line-strong bg-surface text-[16px] text-ink placeholder:text-ink-2 focus:outline focus:outline-2 focus:outline-accent focus:border-transparent'

// How much of a dish's price is already covered by portions handed out.
function assignedValue(item) {
  if (isItemComplete(item)) return item.price
  return item.price * Math.min(getAssignedUnits(item) / getTotalUnits(item), 1)
}

function sharersOf(item, persons) {
  const shares = getItemShares(item)
  return persons.filter((p) => shares[p.id] > 0)
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

// A dish in the list: tap to open it.
function DishRow({ item, persons, onOpen }) {
  const { t } = useTranslation()
  const { fmt } = useCurrency()
  const state = getItemState(item)
  const total = getTotalUnits(item)
  let marker
  if (state === 'unassigned') marker = <span className="text-[13px] font-semibold text-link border-[1.5px] border-dashed border-accent-line rounded-full px-2.5 py-1 whitespace-nowrap">{t('assign.tapToAssign')}</span>
  else if (state === 'partial') marker = <StatusPill tone="warn">{t('assign.portionsOf', { done: getAssignedUnits(item), total })}</StatusPill>
  else if (state === 'everyone') marker = <StatusPill tone="accent">{t('itemizer.everyone')}</StatusPill>
  else marker = <AvatarStack people={sharersOf(item, persons)} />

  return (
    <button type="button" aria-expanded={false} onClick={onOpen} className="w-full flex items-center gap-3 min-h-[60px] px-4 py-2 text-left text-ink hover:bg-surface-2">
      <span className="flex-1 min-w-0 text-[16px] font-medium truncate">
        {item.name || t('itemChip.item')}
        {total > 1 && <em className="not-italic text-ink-2"> ×{total}</em>}
      </span>
      {marker}
      <span className="num min-w-[84px] text-right text-[16px] font-medium">{fmt(item.price)}</span>
    </button>
  )
}

// The open dish: tap a person to give them one portion, "−" takes one back.
function OpenDish({ item, persons, onAddPortion, onRemovePortion, onShareEqually, onEdit, onCollapse }) {
  const { t } = useTranslation()
  const { fmt } = useCurrency()
  const shares = getItemShares(item)
  const state = getItemState(item)
  const total = getTotalUnits(item)
  const assigned = getAssignedUnits(item)
  const complete = isItemComplete(item)

  return (
    <div className="bg-surface border-2 border-accent rounded-card p-4 flex flex-col gap-3">
      <button type="button" aria-expanded onClick={onCollapse} className="flex items-baseline justify-between gap-3 text-left text-[17px] font-semibold">
        <span className="min-w-0">
          {item.name || t('itemChip.item')}
          {total > 1 && <span className="text-ink-2 font-medium"> ×{total}</span>}
        </span>
        <span className="num">{fmt(item.price)}</span>
      </button>
      {state === 'everyone' ? (
        <p className="text-[14px] text-ink-2">{t('itemDetail.splitEquallyAmongEveryone', { amount: fmt(item.price) })}</p>
      ) : (
        !complete && <p className="text-[14px] text-ink-2">{t('assign.tapHint')}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {persons.map((p) => {
          const count = shares[p.id] || 0
          const on = count > 0
          return (
            <span key={p.id} className={`inline-flex items-center min-h-[44px] rounded-full ${on ? 'border-2 border-accent bg-accent-tint' : 'border border-line-strong bg-surface'}`}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onAddPortion(p.id)}
                className={`inline-flex items-center gap-2 min-h-[40px] rounded-full text-[15px] text-ink ${on ? 'pl-[5px] pr-2 font-semibold' : 'pl-1.5 pr-3.5 font-medium hover:bg-surface-2'}`}
              >
                <Avatar size="sm" id={p.id} name={p.name} />
                {p.isMe ? t('assign.you') : p.name}
                {on && <span className="num">×{count}</span>}
              </button>
              {on && (
                <button type="button" onClick={() => onRemovePortion(p.id)} aria-label={t('assign.removePortion', { name: p.name })} className="w-9 h-9 mr-0.5 rounded-full inline-flex items-center justify-center text-accent-ink hover:bg-surface">
                  <Minus size={16} aria-hidden="true" />
                </button>
              )}
            </span>
          )
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
        <span className={`text-[15px] font-semibold ${complete ? 'text-ok' : 'text-warn'}`}>
          {state === 'everyone' ? t('itemizer.everyone') : state === 'group' ? t('itemDetail.sharedChecked', { count: Object.keys(shares).length }) : t('assign.portionsOf', { done: assigned, total })}
        </span>
        <span className="flex flex-wrap gap-1">
          {persons.length > 1 && <Button variant="quiet" size="sm" onClick={onShareEqually}>{t('assign.shareEqually')}</Button>}
          <Button variant="quiet" size="sm" onClick={onEdit}>{t('assign.editDish')}</Button>
        </span>
      </div>
    </div>
  )
}

// Step 2 of 3: who ate what. Tap a dish, then tap people — each tap is one portion.
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
  const [openId, setOpenId] = useState(() => items.find((i) => !isItemComplete(i))?.id ?? null)
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

  // When a dish is fully handed out, jump to the next one still to assign.
  function afterChange(before, after) {
    if (!isItemComplete(before) && isItemComplete(after)) {
      const next = items.find((i) => i.id !== after.id && !isItemComplete(i))
      setOpenId(next?.id ?? null)
    }
  }

  function addPortion(item, memberId) {
    const shares = item.everyone ? {} : { ...getItemShares(item) }
    shares[memberId] = (shares[memberId] || 0) + 1
    const updated = { ...item, shares, everyone: false }
    updateItem(updated)
    afterChange(item, updated)
  }

  function removePortion(item, memberId) {
    const shares = { ...getItemShares(item) }
    if ((shares[memberId] || 0) <= 1) delete shares[memberId]
    else shares[memberId] -= 1
    updateItem(normalizeGroupItem({ ...item, shares }))
  }

  function confirmGroup(selectedIds) {
    if (groupPickerItem) {
      const updated = applySplitGroup(groupPickerItem, selectedIds, activeIds)
      updateItem(updated)
      afterChange(groupPickerItem, updated)
    }
    setGroupPickerItemId(null)
  }

  function addItem(newItem) {
    setItems((prev) => [...prev, newItem])
    if (!openId) setOpenId(newItem.id)
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

  function renderGroup(list, titleKey) {
    if (list.length === 0) return null
    const open = list.find((i) => i.id === openId)
    const rest = list.filter((i) => i.id !== openId)
    return (
      <section className="flex flex-col gap-2.5" aria-label={t(titleKey)}>
        <h2 className="mt-2 text-[16px] font-semibold text-ink-2">
          <b className="text-ink">{t(titleKey)}</b> · {list.length}
        </h2>
        {open && (
          <OpenDish
            item={open}
            persons={activePersons}
            onAddPortion={(id) => addPortion(open, id)}
            onRemovePortion={(id) => removePortion(open, id)}
            onShareEqually={() => setGroupPickerItemId(open.id)}
            onEdit={() => setEditingItemId(open.id)}
            onCollapse={() => setOpenId(null)}
          />
        )}
        {rest.length > 0 && (
          <List>
            {rest.map((item) => (
              <DishRow key={item.id} item={item} persons={activePersons} onOpen={() => setOpenId(item.id)} />
            ))}
          </List>
        )}
      </section>
    )
  }

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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8 lg:items-start">
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

          {renderGroup(toAssign, 'assign.toAssign')}
          {renderGroup(done, 'assign.done')}
        </div>

        <Card as="aside" aria-labelledby="live-title" className="hidden lg:flex lg:sticky lg:top-10">
          <h2 id="live-title" className="text-[18px] font-semibold">{t('itemizer.liveSplit')}</h2>
          <ul className="flex flex-col gap-3">
            {summary.results.map((r) => (
              <li key={r.id} className="flex items-center gap-2.5 text-[15px]">
                <Avatar size="sm" id={r.id} name={r.name} />
                <span className={`flex-1 min-w-0 truncate ${r.isMe ? 'font-semibold' : ''}`}>{r.isMe ? t('assign.you') : r.name}</span>
                <span className={`num ${r.isMe ? 'font-bold' : ''}`}>{fmt(r.finalTotal)}</span>
              </li>
            ))}
          </ul>
          {leftValue > 0.004 && <p className="text-[14px] text-ink-2">{t('assign.unassignedHint')}</p>}
          <div className="flex justify-between gap-3 border-t border-line pt-3 font-semibold">
            <span>{t('assign.totalWithService')}</span>
            <span className="num">{fmt(bill.grandTotal || 0)}</span>
          </div>
          {complete ? (
            <Button block size="lg" variant="primary" onClick={finish}>
              {t('assign.seeSplit')}
              <ArrowRight size={20} aria-hidden="true" />
            </Button>
          ) : (
            <Button block size="lg" disabled>{blockedLabel}</Button>
          )}
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
