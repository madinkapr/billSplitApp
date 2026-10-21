import React from 'react'
import { useTranslation } from 'react-i18next'

const STEPS = ['flow.step1', 'flow.step2', 'flow.step3']

// The 3-step bill progress. Labels show from 640px; phones get just the bars
// (the labels stay for screen readers).
export default function Stepper({ current }) {
  const { t } = useTranslation()
  return (
    <ol aria-label={t('flow.progress')} className="grid grid-cols-3 gap-1.5">
      {STEPS.map((key, i) => {
        const step = i + 1
        const state = step < current ? 'done' : step === current ? 'current' : 'todo'
        return (
          <li key={key} aria-current={state === 'current' ? 'step' : undefined} className={`flex flex-col gap-1.5 text-[13px] ${state === 'current' ? 'text-ink font-semibold' : 'text-ink-2'}`}>
            <span aria-hidden="true" className={`h-1 rounded-sm ${state === 'todo' ? 'bg-line' : 'bg-accent'}`} />
            <span className="sr-only sm:not-sr-only">{t(key)}</span>
          </li>
        )
      })}
    </ol>
  )
}
