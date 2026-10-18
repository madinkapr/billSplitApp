import React from 'react'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import CafesMap from './CafesMap'

// Mobile "Cafes" screen: a back header, the map filling the rest.
export default function CafesPage({ onBack }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 pt-3 pb-2 flex-shrink-0">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold flex-1">{t('nav.cafes')}</h1>
      </div>
      <CafesMap className="flex-1 min-h-0" />
    </div>
  )
}
