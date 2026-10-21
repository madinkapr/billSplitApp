import React, { useState } from 'react'
import { Plus, Minus, Trash2, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getItemShares } from '../utils/math'
import { isGroupItem, normalizeGroupItem } from '../utils/itemizerState'
import { amountToInput } from '../utils/money'
import { useCurrency } from '../hooks/useCurrency'
import Sheet from '../ui/Sheet'
import Button from '../ui/Button'
import Avatar from '../ui/Avatar'
import MoneyInput from '../ui/MoneyInput'

const fieldClass = 'w-full min-h-[48px] px-3.5 rounded-ctl border border-line-strong bg-surface text-[16px] text-ink placeholder:text-ink-2 focus:outline focus:outline-2 focus:outline-accent focus:border-transparent'

// Full edit of one dish: name, price, quantity, and exact portions per person (−/+).
export default function ItemDetailSheet({ item, activePersons, onUpdate, onRemove, onClose, onOpenGroupPicker }) {
  const { t } = useTranslation()
  const { fmt } = useCurrency()
  // Typed text is kept as is ("12." stays while typing); the item gets the parsed number.
  const [priceInput, setPriceInput] = useState(item.price ? amountToInput(item.price) : '')
  const allShares = getItemShares(item)
  const shares = {}
  activePersons.forEach((p) => { if (allShares[p.id] > 0) shares[p.id] = allShares[p.id] })
  const assignedIds = Object.keys(shares)
  const totalCount = assignedIds.reduce((s, id) => s + shares[id], 0)

  // Editing people here keeps a group item a group (still split among whoever is left).
  function setShares(next) {
    const cleaned = {}
    Object.entries(next).forEach(([id, c]) => { if (c > 0) cleaned[id] = c })
    onUpdate(normalizeGroupItem({ ...item, shares: cleaned, everyone: false }))
  }

  function incAssignee(id) { setShares({ ...shares, [id]: (shares[id] || 0) + 1 }) }
  function decAssignee(id) {
    const next = { ...shares }
    if ((next[id] || 0) <= 1) delete next[id]
    else next[id] = next[id] - 1
    setShares(next)
  }

  const isEveryone = item.everyone === true && assignedIds.length === 0
  const isGroup = isGroupItem(item)
  const sharedLabel = isEveryone
    ? t('itemDetail.everyoneChecked')
    : isGroup
      ? t('itemDetail.sharedChecked', { count: assignedIds.length })
      : t('assign.shareEqually')

  const allEqual = assignedIds.length > 0 && assignedIds.every((id) => shares[id] === shares[assignedIds[0]])
  const ratioLabel = assignedIds.length === 0
    ? t('itemDetail.splitEquallyAmongEveryone', { amount: fmt(item.price) })
    : allEqual
      ? t('itemDetail.splitEqually', { amount: fmt(item.price) })
      : t('itemDetail.splitRatio', { amount: fmt(item.price), ratio: assignedIds.map((id) => shares[id]).join(' : ') })

  return (
    <Sheet
      title={t('itemDetail.editItem')}
      onClose={onClose}
      footer={
        <>
          <Button icon variant="secondary" className="!rounded-ctl !w-12 !h-12" onClick={() => { onRemove(); onClose() }} aria-label={t('assign.deleteDish')}>
            <Trash2 size={18} aria-hidden="true" />
          </Button>
          <Button block variant="primary" onClick={onClose}>{t('itemDetail.done')}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="dish-name" className="text-[15px] font-medium text-ink-2">{t('assign.dishName')}</label>
        <input id="dish-name" className={fieldClass} placeholder={t('itemizer.itemNamePlaceholder')} value={item.name} onChange={(e) => onUpdate({ ...item, name: e.target.value })} />
      </div>
      <div className="grid grid-cols-[1fr_96px] gap-2">
        <div className="flex flex-col gap-1.5 min-w-0">
          <label htmlFor="dish-price" className="text-[15px] font-medium text-ink-2">{t('itemizer.totalPrice')}</label>
          <MoneyInput
            id="dish-price"
            value={priceInput}
            onChange={(v) => {
              setPriceInput(v)
              const price = parseFloat(v) || 0
              onUpdate({ ...item, price, unitPrice: price / (item.quantity || 1) })
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="dish-qty" className="text-[15px] font-medium text-ink-2">{t('itemizer.qty')}</label>
          <input
            id="dish-qty"
            className={`${fieldClass} num text-center`}
            type="number"
            inputMode="numeric"
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

      {activePersons.length > 1 && (
        <Button size="sm" variant={isEveryone || isGroup ? 'primary' : 'tint'} className="self-start" onClick={onOpenGroupPicker}>
          <Users size={18} aria-hidden="true" />
          {sharedLabel}
        </Button>
      )}

      <ul className="flex flex-col gap-1.5" aria-label={t('assign.portions')}>
        {activePersons.map((p) => {
          const count = shares[p.id] || 0
          const share = totalCount > 0 && count > 0 ? item.price * (count / totalCount) : 0
          return (
            <li key={p.id} className="flex items-center gap-3 min-h-[52px]">
              <Avatar size="sm" id={p.id} name={p.name} />
              <span className="flex-1 min-w-0">
                <span className="block truncate text-[15px] font-medium">{p.name}{p.isMe ? t('common.you') : ''}</span>
                {count > 0 && <span className="num block text-[13px] text-ink-2">{fmt(share)}</span>}
              </span>
              <Button icon variant="secondary" onClick={() => decAssignee(p.id)} disabled={count === 0} aria-label={t('itemDetail.decreaseShare')}>
                <Minus size={18} aria-hidden="true" />
              </Button>
              <span className="num w-6 text-center font-bold" aria-live="polite">{count}</span>
              <Button icon variant="tint" onClick={() => incAssignee(p.id)} aria-label={t('itemDetail.increaseShare')}>
                <Plus size={18} aria-hidden="true" />
              </Button>
            </li>
          )
        })}
      </ul>
      <p className="text-[14px] text-ink-2">{ratioLabel}</p>
    </Sheet>
  )
}
