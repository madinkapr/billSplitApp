import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import ru from './locales/ru.json'
import uz from './locales/uz.json'

const SUPPORTED_LANGUAGES = ['uz', 'ru', 'en']

function getInitialLanguage() {
  try {
    const stored = JSON.parse(localStorage.getItem('tabup_language'))
    if (SUPPORTED_LANGUAGES.includes(stored)) return stored
  } catch {
    // storage unavailable or malformed — fall through to default
  }
  return 'ru'
}

i18next.use(initReactI18next).init({
  resources: {
    uz: { translation: uz },
    ru: { translation: ru },
    en: { translation: en },
  },
  lng: getInitialLanguage(),
  fallbackLng: 'ru',
  interpolation: { escapeValue: false },
})

export default i18next
