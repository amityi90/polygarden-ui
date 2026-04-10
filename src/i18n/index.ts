/**
 * i18n setup with react-i18next.
 *
 * Why react-i18next?
 * ──────────────────
 * It's the de facto standard for React translations. The `useTranslation` hook
 * gives any component access to the `t()` function: `t('wizard.next')` returns
 * "Next" in English or "Weiter" in German. The language detector reads the
 * browser's preferred language automatically, so German users see German on
 * first load without clicking anything.
 */

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from './locales/en.json'
import de from './locales/de.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      de: { translation: de },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'de'],
    interpolation: {
      escapeValue: false, // React already escapes values — no double-escaping
    },
  })

export default i18n
