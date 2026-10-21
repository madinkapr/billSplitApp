import React, { useState } from 'react'
import { Check, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCurrency } from '../hooks/useCurrency'
import Sheet from '../ui/Sheet'
import Button from '../ui/Button'
import Avatar from '../ui/Avatar'

function Checkbox({ on }) {
  return (
    <span aria-hidden="true" className={`w-5 h-5 rounded-md inline-flex items-center justify-center flex-none ${on ? 'bg-accent text-on-accent' : 'border-2 border-line-strong'}`}>
      {on && <Check size={14} strokeWidth={2.5} />}
    </span>
  )
}

// "Who shares this item?" — opened from "Share equally instead". Everyone starts checked,
// so splitting with the whole table stays a single tap ("Done"); unchecking people narrows
// it to a subset (e.g. two friends sharing one salad). The caller turns the selection into
// an item via applySplitGroup().
export default function SplitGroupPicker({ item, persons, initialSelected, onConfirm, onClose }) {
  const { t } = useTranslation()
  const { fmt } = useCurrency()
  const [selected, setSelected] = useState(() => new Set(initialSelected))

  const allSelected = selected.size === persons.length
  const perPerson = selected.size > 0 ? item.price / selected.size : 0

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(persons.map((p) => p.id)))
  }

  const rowClass = (on) =>
    `w-full flex items-center gap-3 min-h-[52px] px-3 rounded-ctl text-left ${on ? 'border-2 border-accent bg-accent-tint' : 'border border-line bg-surface hover:bg-surface-2'}`

  return (
    <Sheet
      title={t('splitGroup.title')}
      subtitle={t('splitGroup.subtitle', { name: item.name, amount: fmt(item.price) })}
      onClose={onClose}
      footer={
        <div className="w-full flex flex-col gap-2">
          <p className="text-[14px] text-ink-2 text-center" aria-live="polite">
            {selected.size === 0 ? t('splitGroup.pickAtLeastOne') : t('splitGroup.summary', { count: selected.size, amount: fmt(perPerson) })}
          </p>
          <Button block variant="primary" onClick={() => onConfirm([...selected])} disabled={selected.size === 0}>
            {t('splitGroup.done')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        <button type="button" aria-pressed={allSelected} onClick={toggleAll} className={rowClass(allSelected)}>
          <Checkbox on={allSelected} />
          <Users size={18} className="text-accent-ink flex-none" aria-hidden="true" />
          <span className="flex-1 font-semibold text-[15px]">{t('splitGroup.everyone')}</span>
        </button>
        {persons.map((p) => {
          const on = selected.has(p.id)
          return (
            <button key={p.id} type="button" aria-pressed={on} onClick={() => toggle(p.id)} className={rowClass(on)}>
              <Checkbox on={on} />
              <Avatar size="sm" id={p.id} name={p.name} />
              <span className={`flex-1 min-w-0 truncate text-[15px] ${on ? 'font-semibold' : 'text-ink-2'}`}>
                {p.name}
                {p.isMe ? t('common.you') : ''}
              </span>
              {on && <span className="num text-[14px] font-semibold text-accent-ink">{fmt(perPerson)}</span>}
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}
