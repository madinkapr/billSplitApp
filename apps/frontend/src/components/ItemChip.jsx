import React from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Check, GripVertical } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getAssignedUnits, getTotalUnits, getItemState } from '../utils/itemizerState'
import { useCurrency } from '../hooks/useCurrency'

const STATE_STYLES = {
  unassigned: 'border-[1.5px] border-accent bg-surface',
  partial: 'border-[1.5px] border-warn bg-surface',
  done: 'border border-line bg-surface-2',
  everyone: 'border border-line bg-surface-2',
  group: 'border border-line bg-surface-2',
}

function ChipBody({ item, done }) {
  const { t } = useTranslation()
  const { fmt } = useCurrency()
  const total = getTotalUnits(item)
  return (
    <>
      <span className="flex items-center gap-1.5 min-w-0">
        <GripVertical size={16} className={`flex-none ${done ? 'text-ink-2' : 'text-accent-line'}`} aria-hidden="true" />
        <span className={`font-semibold text-[14px] leading-tight line-clamp-2 break-words ${done ? 'line-through text-ink-2' : 'text-ink'}`}>
          {item.name || t('itemChip.item')}
          {total > 1 && <span className="font-medium text-ink-2"> ×{total}</span>}
        </span>
      </span>
      <span className={`num text-[13px] font-bold ${done ? 'text-ink-2' : 'text-link'}`}>{fmt(item.price)}</span>
    </>
  )
}

// What follows the finger/cursor while dragging.
export function ItemChipPreview({ item }) {
  return (
    <div className="rounded-[14px] p-2.5 flex flex-col gap-1 border-[1.5px] border-accent bg-surface w-[190px] rotate-[-4deg] shadow-[0_10px_26px_rgba(0,0,0,.25)]">
      <ChipBody item={item} />
    </div>
  )
}

// A dish waiting to be dragged onto a person. Tap opens the full edit sheet.
export default function ItemChip({ item, onTap }) {
  const { t } = useTranslation()
  const state = getItemState(item)
  const done = state === 'done' || state === 'everyone' || state === 'group'
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id, disabled: done })

  const assigned = getAssignedUnits(item)
  const total = getTotalUnits(item)
  const style = { touchAction: 'none', ...(transform ? { transform: CSS.Translate.toString(transform) } : {}) }

  if (isDragging) {
    return (
      <div ref={setNodeRef} style={style} className="min-h-[60px] rounded-[14px] border-[1.5px] border-dashed border-line-strong bg-surface opacity-60" />
    )
  }

  return (
    <button
      type="button"
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onTap}
      aria-label={`${item.name || t('itemChip.item')}: ${t('assign.editDish')}`}
      className={`relative w-full min-h-[60px] rounded-[14px] p-2.5 flex flex-col items-stretch gap-1 text-left ${done ? '' : 'cursor-grab active:cursor-grabbing'} ${STATE_STYLES[state]}`}
    >
      {state === 'partial' && (
        <span className="num absolute -top-2 -right-1.5 text-[13px] font-bold px-1.5 rounded-full bg-warn text-surface">
          {assigned}/{total}
        </span>
      )}
      {done && (
        <span className="absolute -top-2 -right-1.5 w-5 h-5 rounded-full bg-ok-fill text-surface inline-flex items-center justify-center" aria-hidden="true">
          <Check size={13} strokeWidth={3} />
        </span>
      )}
      <ChipBody item={item} done={done} />
    </button>
  )
}
