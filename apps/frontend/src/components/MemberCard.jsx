import React from 'react'
import { useDroppable } from '@dnd-kit/core'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getItemShares } from '../utils/math'
import { getUnitPrice } from '../utils/itemizerState'
import { useCurrency } from '../hooks/useCurrency'
import QuantityStepper from './QuantityStepper'

export default function MemberCard({
  member,
  isEveryone,
  items,
  pendingStepper,
  activeDragItem,
  onCommitStepper,
  onCancelStepper,
  onRemoveAssignment,
}) {
  const { t } = useTranslation()
  const { fmt } = useCurrency()
  const { setNodeRef, isOver } = useDroppable({ id: member.id })

  // Assigned-item rows: for a regular member, every item where they have a share count.
  // For Everyone, every item explicitly marked `everyone: true`.
  const assignedRows = isEveryone
    ? items.filter((i) => i.everyone === true && Object.keys(getItemShares(i)).length === 0)
    : items
        .map((i) => ({ item: i, count: getItemShares(i)[member.id] || 0 }))
        .filter((r) => r.count > 0)

  const subtotal = isEveryone
    ? assignedRows.reduce((s, item) => s + item.price, 0)
    : assignedRows.reduce((s, r) => s + getUnitPrice(r.item) * r.count, 0)

  const showStepper = pendingStepper?.memberId === member.id
  const isDropTarget = isOver && activeDragItem

  let cardStyle = 'border-[1.5px] border-line bg-white' // filled (default)
  if (isDropTarget) {
    cardStyle = 'border-2 border-accent bg-accent-tint shadow-[0_0_0_4px_rgba(22,105,211,.12)]'
  } else if (assignedRows.length === 0) {
    cardStyle = 'border-[1.5px] border-dashed border-line-dashed bg-white'
  }

  return (
    <div ref={setNodeRef} className={`rounded-2xl p-[9px] flex flex-col gap-2 ${cardStyle}`}>
      <div className="flex items-center gap-[9px]">
        <div
          className={`w-[22px] h-[22px] rounded-full flex-none flex items-center justify-center text-[10px] font-bold ${
            assignedRows.length > 0 || isDropTarget ? 'bg-accent text-white' : 'bg-line-dashed text-ink-muted'
          }`}
        >
          {isEveryone ? '∀' : (member.name || '?').charAt(0).toUpperCase()}
        </div>
        <span className="font-bold text-xs flex-1 truncate">{member.name}{member.isMe ? t('common.you') : ''}</span>
        {assignedRows.length > 0 && (
          <span className="text-[10px] text-ink-muted font-semibold">{fmt(subtotal)}</span>
        )}
      </div>

      {isEveryone && assignedRows.length > 0 && (
        <div className="inline-flex items-center gap-1 text-[10.5px] font-bold text-accent bg-accent-tint rounded-full px-2 py-0.5 self-start">
          {t('memberCard.splitEqually')}
        </div>
      )}

      {showStepper && (
        <QuantityStepper
          itemName={pendingStepper.itemName}
          memberName={member.name}
          max={pendingStepper.max}
          onCommit={(qty) => onCommitStepper(qty)}
          onCancel={onCancelStepper}
        />
      )}

      {assignedRows.length === 0 && !showStepper && (
        <p className="text-[10.5px] text-ink-faint italic py-[1px]">
          {isDropTarget ? t('memberCard.releaseHere') : isEveryone ? t('memberCard.splitEquallyItalic') : t('memberCard.dragHere')}
        </p>
      )}

      {assignedRows.map((row) => {
        if (isEveryone) {
          const item = row
          return (
            <div key={item.id} className="flex items-center gap-2 bg-canvas rounded-[9px] px-[9px] py-1.5 text-[10.5px]">
              <span className="flex-1 font-semibold truncate">{item.name}</span>
              <span className="text-accent font-bold">{fmt(item.price)}</span>
              <button onClick={() => onRemoveAssignment(item.id)} className="text-ink-faint font-bold">✕</button>
            </div>
          )
        }
        const { item, count } = row
        return (
          <div key={item.id} className="flex items-center gap-2 bg-canvas rounded-[9px] px-[9px] py-1.5 text-[10.5px]">
            <span className="flex-1 font-semibold truncate">{item.name} ×{count}</span>
            <span className="text-accent font-bold">{fmt(getUnitPrice(item) * count)}</span>
            <button onClick={() => onRemoveAssignment(item.id)} className="text-ink-faint font-bold flex items-center">
              <X size={11} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
