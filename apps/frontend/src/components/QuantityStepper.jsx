import React, { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

// "How many X did Y have?" — shown in a person's card after dropping a dish with
// several portions left.
export default function QuantityStepper({ itemName, memberName, max, onCommit, onCancel }) {
  const { t } = useTranslation()
  const [qty, setQty] = useState(1)

  return (
    <div className="bg-surface rounded-ctl border border-line shadow-lg p-2.5 flex flex-col gap-2">
      <p className="text-[14px] font-semibold">{t('quantityStepper.question', { item: itemName, member: memberName })}</p>
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setQty((q) => Math.max(1, q - 1))}
          disabled={qty <= 1}
          aria-label={t('itemDetail.decreaseShare')}
          className="w-11 h-11 rounded-full border-[1.5px] border-accent text-link inline-flex items-center justify-center disabled:opacity-40"
        >
          <Minus size={16} aria-hidden="true" />
        </button>
        <span className="num text-[16px] font-bold min-w-[20px] text-center" aria-live="polite">{qty}</span>
        <button
          type="button"
          onClick={() => setQty((q) => Math.min(max, q + 1))}
          disabled={qty >= max}
          aria-label={t('itemDetail.increaseShare')}
          className="w-11 h-11 rounded-full bg-accent text-on-accent inline-flex items-center justify-center disabled:opacity-40"
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="flex gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="flex-1 min-h-[44px] rounded-ctl text-[14px] font-semibold text-ink-2 hover:bg-surface-2">
            {t('quantityStepper.cancel')}
          </button>
        )}
        <button type="button" onClick={() => onCommit(qty)} className="flex-1 min-h-[44px] rounded-ctl bg-accent text-on-accent text-[14px] font-semibold hover:bg-accent-ink">
          {t('quantityStepper.add')}
        </button>
      </div>
    </div>
  )
}
