import React from 'react'
import { useDroppable } from '@dnd-kit/core'
import { X, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getItemShares } from '../utils/math'
import { getMemberItemAmount, isGroupItem } from '../utils/itemizerState'
import { useCurrency } from '../hooks/useCurrency'
import Avatar from '../ui/Avatar'
import QuantityStepper from './QuantityStepper'

// Drop target for one person (or "Everyone"): shows what they have and their subtotal.
export default function MemberCard({ member, isEveryone, items, pendingStepper, activeDragItem, onCommitStepper, onCancelStepper, onRemoveAssignment }) {
  const { t } = useTranslation()
  const { fmt } = useCurrency()
  const { setNodeRef, isOver } = useDroppable({ id: member.id })

  // Assigned-item rows: for a regular member, every item where they have a share count
  // (including group items they share with a few others). For Everyone, every item
  // explicitly marked `everyone: true`.
  const assignedRows = isEveryone
    ? items.filter((i) => i.everyone === true && Object.keys(getItemShares(i)).length === 0).map((item) => ({ item, count: 1 }))
    : items.map((i) => ({ item: i, count: getItemShares(i)[member.id] || 0 })).filter((r) => r.count > 0)

  const subtotal = isEveryone
    ? assignedRows.reduce((s, r) => s + r.item.price, 0)
    : assignedRows.reduce((s, r) => s + getMemberItemAmount(r.item, member.id), 0)

  const showStepper = pendingStepper?.memberId === member.id
  const isDropTarget = isOver && activeDragItem
  const isEmpty = assignedRows.length === 0

  const cardStyle = isDropTarget
    ? 'border-2 border-accent bg-accent-tint ring-4 ring-accent/15'
    : isEmpty
      ? 'border-[1.5px] border-dashed border-line-strong bg-surface'
      : 'border border-line bg-surface'

  return (
    <div ref={setNodeRef} className={`rounded-card p-2.5 sm:p-3 flex flex-col gap-2 transition-colors ${cardStyle}`}>
      <div className="flex items-center gap-2">
        {isEveryone ? (
          <Avatar size="sm" tone={isEmpty && !isDropTarget ? 'off' : 'solid'}><Users size={14} aria-hidden="true" /></Avatar>
        ) : (
          <Avatar size="sm" id={member.id} name={member.name} tone={isEmpty && !isDropTarget ? 'off' : undefined} />
        )}
        <span className="flex-1 min-w-0">
          <span className="block font-semibold text-[15px] truncate">{member.name}{member.isMe ? t('common.you') : ''}</span>
          {!isEmpty && <span className="num block text-[14px] font-bold text-link">{fmt(subtotal)}</span>}
        </span>
      </div>

      {isEveryone && !isEmpty && (
        <span className="inline-flex items-center text-[13px] font-semibold text-accent-ink bg-accent-tint rounded-full px-2 py-0.5 self-start">
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
        <p className="text-[13px] text-ink-2 italic">
          {isDropTarget ? t('memberCard.releaseHere') : isEveryone ? t('memberCard.splitEquallyItalic') : t('memberCard.dragHere')}
        </p>
      )}

      {assignedRows.map(({ item, count }) => {
        const group = !isEveryone && isGroupItem(item)
        const label = isEveryone || group || count === 1 ? item.name : `${item.name} ×${count}`
        const amount = isEveryone ? item.price : getMemberItemAmount(item, member.id)
        return (
          <div key={item.id} className="flex items-center gap-1 bg-bg rounded-[10px] pl-2.5 py-1 text-[13px]">
            <span className="flex-1 min-w-0">
              <span className="flex items-center gap-1 min-w-0">
                <span className="font-medium truncate">{label}</span>
                {group && (
                  <span className="flex-none inline-flex items-center gap-0.5 font-semibold text-accent-ink bg-accent-tint rounded-full px-1.5">
                    <Users size={12} aria-hidden="true" />
                    {Object.keys(getItemShares(item)).length}
                  </span>
                )}
              </span>
              <span className="num block font-bold text-link">{fmt(amount)}</span>
            </span>
            <button
              type="button"
              onClick={() => onRemoveAssignment(item.id)}
              aria-label={t('memberCard.remove', { item: item.name, name: member.name })}
              className="w-9 h-9 flex-none inline-flex items-center justify-center rounded-full text-ink-2 hover:text-ink hover:bg-surface-2"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
