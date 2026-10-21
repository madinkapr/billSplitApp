import React, { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, useDragControls } from 'framer-motion'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Button from './Button'

// Modal panel: a bottom sheet on phones, a centred dialog from 640px. Escape and a tap on
// the backdrop close it; focus moves into it and returns to the opener afterwards.
export default function Sheet({ title, subtitle, onClose, footer, children, wide = false }) {
  const { t } = useTranslation()
  const titleId = useId()
  const panelRef = useRef(null)
  const dragControls = useDragControls()

  useEffect(() => {
    const opener = document.activeElement
    panelRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      opener?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        drag="y"
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, info) => (info.offset.y > 100 || info.velocity.y > 500) && onClose()}
        className={`w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[90dvh] flex flex-col bg-surface text-ink rounded-t-[20px] sm:rounded-card shadow-xl outline-none`}
      >
        {/* Grab handle: pull the sheet down to close it (phones). */}
        <div
          aria-hidden="true"
          onPointerDown={(e) => dragControls.start(e)}
          className="sm:hidden flex justify-center pt-2.5 pb-1 touch-none cursor-grab"
        >
          <span className="w-10 h-1.5 rounded-full bg-line-strong" />
        </div>
        <div className="flex items-start gap-3 px-5 pt-1 sm:pt-4 pb-3 border-b border-line">
          <div className="flex-1 min-w-0 pt-2">
            <h2 id={titleId} className="text-[18px] font-semibold leading-tight">{title}</h2>
            {subtitle && <p className="text-[14px] text-ink-2 mt-0.5">{subtitle}</p>}
          </div>
          <Button icon variant="secondary" onClick={onClose} aria-label={t('common.close')} className="!border-transparent -mr-2">
            <X size={20} aria-hidden="true" />
          </Button>
        </div>
        <div className={`overflow-y-auto flex-1 px-5 pt-4 flex flex-col gap-4 ${footer ? 'pb-4' : 'pb-[calc(20px+env(safe-area-inset-bottom))] sm:pb-5'}`}>{children}</div>
        {footer && <div className="px-5 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))] sm:pb-4 border-t border-line flex gap-2">{footer}</div>}
      </motion.div>
    </motion.div>,
    document.body
  )
}
