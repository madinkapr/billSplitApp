import React from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getAssignedUnits, getTotalUnits, getItemState } from '../utils/itemizerState'
import { useCurrency } from '../hooks/useCurrency'

function Grip() {
  return (
    <div className="flex flex-col gap-[2px] flex-none">
      <div className="w-[11px] h-[2px] rounded-sm bg-accent-grip" />
      <div className="w-[11px] h-[2px] rounded-sm bg-accent-grip" />
      <div className="w-[11px] h-[2px] rounded-sm bg-accent-grip" />
    </div>
  )
}

const STATE_STYLES = {
  unassigned: 'border-[1.5px] border-accent bg-white',
  partial: 'border-[1.5px] border-warn bg-white',
  done: 'border-[1.5px] border-line bg-canvas opacity-75',
  everyone: 'border-[1.5px] border-line bg-canvas opacity-75',
}

export function ItemChipPreview({ item }) {
  const { t } = useTranslation()
  const { fmt } = useCurrency()
  const assigned = getAssignedUnits(item)
  const total = getTotalUnits(item)
  return (
    <div
      style={{ transform: 'rotate(-4deg)', boxShadow: '0 10px 26px rgba(20,20,40,.22)' }}
      className="rounded-[14px] p-[9px] flex items-center justify-between border-[1.5px] border-accent bg-white w-[170px]"
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <Grip />
        <span className="font-bold text-[11.5px] truncate text-ink">{item.name || t('itemChip.item')}</span>
      </div>
      <span className="text-[10px] font-bold flex-none text-accent">{fmt(item.price)} · {assigned}/{total}</span>
    </div>
  )
}

export default function ItemChip({ item, onTap }) {
  const { t } = useTranslation()
  const { fmt } = useCurrency()
  const state = getItemState(item)
  const disabled = state === 'done' || state === 'everyone'
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    disabled,
  })

  const assigned = getAssignedUnits(item)
  const total = getTotalUnits(item)

  const style = transform
    ? { transform: CSS.Translate.toString(transform), touchAction: 'none' }
    : { touchAction: 'none' }

  if (isDragging) {
    return (
      <div ref={setNodeRef} style={style} className="rounded-[14px] p-[9px] flex items-center justify-between border-[1.5px] border-dashed border-line bg-white opacity-50">
        <div className="flex items-center gap-1.5">
          <Grip />
          <span className="font-bold text-[11.5px] text-line-dashed">{item.name}</span>
        </div>
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
      className={`relative rounded-[14px] p-[9px] flex items-center justify-between ${STATE_STYLES[state]}`}
    >
      {state === 'partial' && (
        <div className="absolute -top-[7px] -right-[6px] text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-warn text-white">
          {assigned}/{total}
        </div>
      )}
      {(state === 'done' || state === 'everyone') && (
        <div className="absolute -top-[7px] -right-[6px] text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-success text-white flex items-center justify-center w-4 h-4">
          <Check size={10} />
        </div>
      )}
      <div className="flex items-center gap-1.5 min-w-0">
        <Grip />
        <span className={`font-bold text-[11.5px] truncate ${disabled ? 'line-through text-ink-muted' : 'text-ink'}`}>
          {item.name || t('itemChip.item')}
        </span>
      </div>
      <span className={`text-[10px] font-bold flex-none ${disabled ? 'text-ink-muted' : 'text-accent'}`}>
        {disabled ? fmt(item.price) : `${fmt(item.price)} · ${assigned}/${total}`}
      </span>
    </div>
  )
}
