import React from 'react'
import { Flame } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Skeleton from '../ui/Skeleton'

// "92 daqiqa" reads as a big scary number — "1 soat 32 daqiqa" reads the way people
// actually think about walking time. Math is unchanged, just presentation.
function formatWalkDuration(totalMinutes, t) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return t('report.durationMinutes', { minutes })
  if (minutes === 0) return t('report.durationHours', { hours })
  return t('report.durationHoursMinutes', { hours, minutes })
}

export default function CalorieEstimate({ estimate }) {
  const { t } = useTranslation()

  if (estimate.loading) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label={t('report.caloriesLoading')}>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-[120px] !rounded-card" />
      </div>
    )
  }

  if (estimate.error || !estimate.perPerson) {
    return <p className="text-[14px] text-ink-2">{t('report.caloriesUnavailable')}</p>
  }

  return (
    <section aria-labelledby="calories-title" className="flex flex-col gap-2.5">
      <h2 id="calories-title" className="text-[18px] font-semibold">{t('report.caloriesHeader')}</h2>
      <ul className="bg-surface border border-line rounded-card overflow-hidden divide-y divide-line">
        {estimate.perPerson.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-4 py-3">
            <Flame size={18} className="text-warn flex-none" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-medium truncate">{p.name}{p.isMe ? t('common.you') : ''}</p>
              <p className="text-[14px] text-ink-2">
                {p.steps > 0
                  ? t('report.caloriesLine', {
                      calories: p.calories.toLocaleString(),
                      steps: p.steps.toLocaleString(),
                      walkDuration: formatWalkDuration(p.walkMinutes, t),
                    })
                  : t('report.caloriesLineCovered', { calories: p.calories.toLocaleString() })}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
