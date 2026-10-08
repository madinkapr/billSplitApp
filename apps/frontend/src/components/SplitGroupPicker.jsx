import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCurrency } from '../hooks/useCurrency'

// "Who shares this item?" — opened when an item is dropped on the shared card or the
// "Shared" button is tapped. Everyone starts checked, so splitting with the whole table
// stays a single tap ("Done"); unchecking people narrows it to a subset (e.g. two friends
// sharing one salad). The caller turns the selection into an item via applySplitGroup().
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

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-xl"
        >
          <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-gray-100">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-gray-900">{t('splitGroup.title')}</h2>
              <p className="text-xs text-gray-500 truncate mt-0.5">{t('splitGroup.subtitle', { name: item.name, amount: fmt(item.price) })}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full hover:bg-gray-100">
              <X size={16} />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={toggleAll}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 border-2 text-left transition-colors ${
                allSelected ? 'border-accent bg-accent-tint' : 'border-gray-200 bg-white'
              }`}
            >
              <span className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${allSelected ? 'bg-accent text-white' : 'border-2 border-gray-300'}`}>
                {allSelected && <Check size={13} />}
              </span>
              <Users size={16} className="text-accent flex-shrink-0" />
              <span className="font-semibold text-sm text-gray-900 flex-1">{t('splitGroup.everyone')}</span>
            </button>

            {persons.map((p) => {
              const on = selected.has(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border text-left transition-colors ${
                    on ? 'border-accent/50 bg-white' : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${on ? 'bg-accent text-white' : 'border-2 border-gray-300'}`}>
                    {on && <Check size={13} />}
                  </span>
                  <span className={`text-sm flex-1 min-w-0 truncate ${on ? 'font-semibold text-gray-900' : 'text-gray-400'}`}>
                    {p.name}
                    {p.isMe ? t('common.you') : ''}
                  </span>
                  {on && <span className="text-xs font-bold text-accent flex-shrink-0">{fmt(perPerson)}</span>}
                </button>
              )
            })}
          </div>

          <div className="px-5 py-4 border-t border-gray-100 flex flex-col gap-2">
            <p className="text-xs text-gray-500 text-center">
              {selected.size === 0
                ? t('splitGroup.pickAtLeastOne')
                : t('splitGroup.summary', { count: selected.size, amount: fmt(perPerson) })}
            </p>
            <button
              onClick={() => onConfirm([...selected])}
              disabled={selected.size === 0}
              className="btn-primary w-full text-sm disabled:opacity-40"
            >
              {t('splitGroup.done')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
