import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getLocales } from 'expo-localization'

import fr from '../locales/fr.json'
import en from '../locales/en.json'

const LOCALE_KEY = '@app_locale'

const getDeviceLocale = () => {
  try {
    const locales = getLocales()
    const lang = locales?.[0]?.languageCode
    return lang === 'en' ? 'en' : 'fr'
  } catch {
    return 'fr'
  }
}

// Init synchronously with device locale (no flash)
i18n
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
    },
    lng: getDeviceLocale(),
    fallbackLng: 'fr',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  })

// Then check AsyncStorage for user preference (override if saved)
AsyncStorage.getItem(LOCALE_KEY)
  .then((saved) => {
    if (saved && saved !== i18n.language) {
      i18n.changeLanguage(saved)
    }
  })
  .catch(() => {})

// Persist language changes
i18n.on('languageChanged', (lng) => {
  AsyncStorage.setItem(LOCALE_KEY, lng).catch(() => {})
})

export default i18n
