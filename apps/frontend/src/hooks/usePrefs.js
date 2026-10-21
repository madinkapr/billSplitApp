import { useTranslation } from 'react-i18next'

export const LANGUAGES = [
  { code: 'uz', label: "O'zbek" },
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
]

// The UI language, with i18next as the single source of truth (every useTranslation()
// re-renders on a switch) and localStorage remembering it for the next visit.
export function useLanguage() {
  const { i18n } = useTranslation()
  const language = i18n.resolvedLanguage || i18n.language

  function setLanguage(code) {
    i18n.changeLanguage(code)
    try {
      localStorage.setItem('tabup_language', JSON.stringify(code))
    } catch {
      // storage full or unavailable
    }
  }

  return { language, setLanguage, label: LANGUAGES.find((l) => l.code === language)?.label ?? language }
}
