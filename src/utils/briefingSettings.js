import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = '@briefing_settings'

const DEFAULT = {
  enabled: true,
  time: '06:30',
  paused_until: null,
}

export async function getBriefingSettings() {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT
  } catch {
    return DEFAULT
  }
}

export async function saveBriefingSettings(settings) {
  await AsyncStorage.setItem(KEY, JSON.stringify(settings))
}

export async function isBriefingActive() {
  const s = await getBriefingSettings()
  if (!s.enabled) return false
  if (s.paused_until && new Date(s.paused_until) > new Date()) return false
  return true
}
