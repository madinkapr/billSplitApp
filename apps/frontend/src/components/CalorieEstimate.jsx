import React from 'react'
import { Flame, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

// "92 daqiqa" reads as a big scary number — "1 soat 32 daqiqa" reads the way people
// actually think about walking time. Math is unchanged, just presentation.
function formatWalkDuration(totalMinutes, t) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return t('report.durationMinutes', { minutes })
  if (minutes === 0) return t('report.durationHours', { hours })
  return t('report.durationHoursMinutes', { hours, minutes })
}

export default function CalorieEstimate({ estimate, theme = 'mobile' }) {
  const { t } = useTranslation()
  const isDesktop = theme === 'desktop'

  const cardBorder = isDesktop ? 'border-desktop-cardBorder' : 'border-gray-100'
  const textMuted = isDesktop ? 'text-desktop-textMuted3' : 'text-gray-400'
  const textBody = isDesktop ? 'text-desktop-text' : 'text-gray-800'
  const rowDivide = isDesktop ? 'divide-desktop-divider' : 'divide-gray-50'

  if (estimate.loading) {
    return (
      <div className={`flex items-center gap-2 px-1 text-xs ${textMuted}`}>
        <Loader2 size={13} className="animate-spin" /> {t('report.caloriesLoading')}
      </div>
    )
  }

  if (estimate.error || !estimate.perPerson) {
    return <p className={`text-xs px-1 ${textMuted}`}>{t('report.caloriesUnavailable')}</p>
  }

  return (
    <div>
      <h2 className={`text-[12px] font-bold uppercase tracking-wide mb-2 ${textMuted}`}>{t('report.caloriesHeader')}</h2>
      <div className={`bg-white border ${cardBorder} rounded-2xl overflow-hidden divide-y ${rowDivide}`}>
        {estimate.perPerson.map((p) => (
          <div key={p.id} className="flex items-center gap-3 px-4 py-3">
            <Flame size={16} className="text-orange-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${textBody}`}>{p.name}{p.isMe ? t('common.you') : ''}</p>
              <p className={`text-xs ${textMuted}`}>
                {t('report.caloriesLine', {
                  calories: p.calories.toLocaleString(),
                  steps: p.steps.toLocaleString(),
                  walkDuration: formatWalkDuration(p.walkMinutes, t),
                })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
