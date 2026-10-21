import React from 'react'
import { useTranslation } from 'react-i18next'
import CafesMap from '../components/CafesMap'

// The cafe map fills the screen; phones get a title above it.
export default function Cafes() {
  const { t } = useTranslation()
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <h1 className="lg:sr-only px-4 sm:px-6 pb-2 pt-[calc(12px+env(safe-area-inset-top))] text-[18px] font-semibold">{t('nav.cafes')}</h1>
      <CafesMap className="block flex-1 min-h-[420px]" />
    </div>
  )
}
