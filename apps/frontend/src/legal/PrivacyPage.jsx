import React from 'react'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PRIVACY, PRIVACY_UPDATED, PRIVACY_CONTACT_EMAIL } from './privacyContent'

// Public privacy policy at /privacy — linked from the home page footer and the sign-up
// form, and given to Google as the app's privacy policy URL.
export default function PrivacyPage({ onBack }) {
  const { i18n } = useTranslation()
  const lang = PRIVACY[i18n.language] ? i18n.language : 'uz'
  const p = PRIVACY[lang]

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <button onClick={onBack} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} />
          {p.back}
        </button>

        <article className="card p-6 sm:p-8 flex flex-col gap-6 text-gray-700">
          <header className="flex flex-col gap-2">
            <img src="/logo-schet.png" alt="SCHET.uz" className="h-9 w-auto object-contain self-start" />
            <h1 className="text-2xl font-bold text-gray-900">{p.title}</h1>
            <p className="text-xs text-gray-400">
              {p.updated}: {PRIVACY_UPDATED}
            </p>
            <p className="text-sm leading-relaxed">{p.intro}</p>
          </header>

          {p.sections.map((s) => (
            <section key={s.h} className="flex flex-col gap-2">
              <h2 className="text-base font-semibold text-gray-900">{s.h}</h2>
              <ul className="list-disc pl-5 flex flex-col gap-1.5 text-sm leading-relaxed">
                {s.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}

          <footer className="border-t border-gray-100 pt-4 text-sm">
            {p.contact}:{' '}
            <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`} className="font-semibold text-indigo-600 hover:underline">
              {PRIVACY_CONTACT_EMAIL}
            </a>
          </footer>
        </article>
      </div>
    </div>
  )
}
