import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Minus, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function QuantityStepper({ itemName, memberName, max, onCommit, onCancel }) {
  const { t } = useTranslation()
  const [qty, setQty] = useState(1)

  return (
    <div className="bg-white rounded-xl border border-line shadow-[0_6px_18px_rgba(20,20,40,.14)] p-2.5 flex flex-col gap-2">
      <p className="text-[11px] font-semibold text-ink">{t('quantityStepper.question', { item: itemName, member: memberName })}</p>
      <div className="flex items-center justify-center gap-3">
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={() => setQty((q) => Math.max(1, q - 1))}
          className="w-[22px] h-[22px] rounded-full border-[1.5px] border-accent text-accent flex items-center justify-center"
        >
          <Minus size={12} />
        </motion.button>
        <span className="text-xs font-bold min-w-[16px] text-center tabular-nums">{qty}</span>
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={() => setQty((q) => Math.min(max, q + 1))}
          className="w-[22px] h-[22px] rounded-full bg-accent text-white flex items-center justify-center"
        >
          <Plus size={12} />
        </motion.button>
      </div>
      <div className="flex gap-2">
        {onCancel && (
          <button onClick={onCancel} className="flex-1 text-[10.5px] font-semibold text-ink-muted py-1.5">
            {t('quantityStepper.cancel')}
          </button>
        )}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => onCommit(qty)}
          className="flex-1 bg-accent text-white text-center rounded-full py-1.5 font-bold text-[10.5px]"
        >
          {t('quantityStepper.add')}
        </motion.button>
      </div>
    </div>
  )
}
