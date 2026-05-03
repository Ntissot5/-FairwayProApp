import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform, NativeModules } from 'react-native'
import fr from './locales/fr.json'
import en from './locales/en.json'

const STORAGE_KEY = '@fairwaypro_locale'

// Detect device language
const getDeviceLanguage = () => {
  const locale = Platform.OS === 'ios'
    ? NativeModules.SettingsManager?.settings?.AppleLocale || NativeModules.SettingsManager?.settings?.AppleLanguages?.[0]
    : NativeModules.I18nManager?.localeIdentifier
  if (locale?.startsWith('fr')) return 'fr'
  if (locale?.startsWith('de')) return 'de'
  return 'fr' // Default to French (FairwayPro is FR-first)
}

i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr }, en: { translation: en } },
  lng: getDeviceLanguage(),
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
})

// Load saved preference
AsyncStorage.getItem(STORAGE_KEY).then(lang => {
  if (lang) i18n.changeLanguage(lang)
})

export const setLocale = async (lang) => {
  await AsyncStorage.setItem(STORAGE_KEY, lang)
  i18n.changeLanguage(lang)
}

export default i18n
