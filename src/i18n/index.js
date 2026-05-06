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

const languageDetector = {
  type: 'languageDetector',
  async: true,
  detect: async (callback) => {
    try {
      const saved = await AsyncStorage.getItem(LOCALE_KEY)
      if (saved) {
        callback(saved)
        return
      }
    } catch {}
    callback(getDeviceLocale())
  },
  init: () => {},
  cacheUserLanguage: async (lng) => {
    try {
      await AsyncStorage.setItem(LOCALE_KEY, lng)
    } catch {}
  },
}

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
    },
    fallbackLng: 'fr',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  })

export default i18n
