import { useState, useEffect, useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from './supabase'
import { useTheme } from './ThemeContext'
import { useTranslation } from 'react-i18next'
import { setLocale } from './i18n'
import AnimatedPressable from './components/AnimatedPressable'

const THEME_OPTIONS = [
  { key: 'light', icon: 'sunny-outline' },
  { key: 'dark', icon: 'moon-outline' },
  { key: 'system', icon: 'phone-portrait-outline' },
]

const LANG_OPTIONS = [
  { key: 'fr', label: 'Francais', flag: '🇫🇷' },
  { key: 'en', label: 'English', flag: '🇬🇧' },
]

export default function SettingsScreen({ navigation }) {
  const { colors, mode, setThemeMode } = useTheme()
  const { t, i18n } = useTranslation()
  const [user, setUser] = useState(null)
  const s = useMemo(() => makeStyles(colors), [colors])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    navigation.replace('Welcome')
  }

  const changeLanguage = async (lang) => {
    await setLocale(lang)
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>{t('settings.title')}</Text>
      </View>
      <ScrollView style={s.scroll}>
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('settings.account')}</Text>
          <View style={s.row}>
            <View style={s.av}>
              <Text style={s.avTxt}>{user?.email?.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={s.info}>
              <Text style={s.email}>{user?.email}</Text>
              <Text style={s.role}>{t('settings.headCoach')}</Text>
            </View>
          </View>
        </View>
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('settings.appearance')}</Text>
          <View style={s.themeRow}>
            {THEME_OPTIONS.map(opt => (
              <AnimatedPressable key={opt.key} style={[s.themeBtn, mode === opt.key && s.themeBtnActive]} onPress={() => setThemeMode(opt.key)}>
                <Ionicons name={opt.icon} size={20} color={mode === opt.key ? colors.primary : colors.textTertiary} />
                <Text style={[s.themeTxt, mode === opt.key && s.themeTxtActive]}>{t('settings.' + opt.key)}</Text>
              </AnimatedPressable>
            ))}
          </View>
        </View>
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('settings.language')}</Text>
          <View style={s.themeRow}>
            {LANG_OPTIONS.map(opt => (
              <AnimatedPressable key={opt.key} style={[s.themeBtn, i18n.language === opt.key && s.themeBtnActive]} onPress={() => changeLanguage(opt.key)}>
                <Text style={{ fontSize: 20 }}>{opt.flag}</Text>
                <Text style={[s.themeTxt, i18n.language === opt.key && s.themeTxtActive]}>{opt.label}</Text>
              </AnimatedPressable>
            ))}
          </View>
        </View>
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('settings.app')}</Text>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>{t('settings.version')}</Text>
            <Text style={s.infoValue}>1.0.0</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>{t('settings.platform')}</Text>
            <Text style={s.infoValue}>iOS</Text>
          </View>
        </View>
        <AnimatedPressable style={s.subBtn} onPress={() => navigation.navigate('Subscribe')}>
          <Ionicons name="card-outline" size={18} color={colors.primary} />
          <Text style={s.subTxt}>{t('settings.subscription')}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </AnimatedPressable>
        <AnimatedPressable style={s.signOutBtn} onPress={signOut}>
          <Ionicons name="log-out-outline" size={18} color={colors.destructive} />
          <Text style={s.signOutTxt}>{t('settings.signOut')}</Text>
        </AnimatedPressable>
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bgSecondary },
  header: { backgroundColor: c.card, padding: 20, paddingTop: 10, borderBottomWidth: 0.5, borderBottomColor: c.separator },
  title: { fontSize: 24, fontWeight: '800', color: c.text, letterSpacing: -0.5 },
  scroll: { flex: 1 },
  section: { backgroundColor: c.card, borderRadius: 16, margin: 16, marginBottom: 8, padding: 16, borderWidth: 0.5, borderColor: c.separator },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: c.textTertiary, letterSpacing: 0.1, marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  av: { width: 48, height: 48, borderRadius: 24, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  avTxt: { color: '#fff', fontSize: 18, fontWeight: '700' },
  info: { flex: 1 },
  email: { fontSize: 15, fontWeight: '600', color: c.text },
  role: { fontSize: 11, color: c.textTertiary, marginTop: 2, letterSpacing: 0.1 },
  themeRow: { flexDirection: 'row', gap: 10 },
  themeBtn: { flex: 1, alignItems: 'center', gap: 6, padding: 14, borderRadius: 12, backgroundColor: c.bgSecondary, borderWidth: 1.5, borderColor: 'transparent' },
  themeBtnActive: { borderColor: c.primary, backgroundColor: c.primaryLight },
  themeTxt: { fontSize: 12, fontWeight: '600', color: c.textTertiary },
  themeTxtActive: { color: c.primary },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: c.separatorLight },
  infoLabel: { fontSize: 14, color: c.text },
  infoValue: { fontSize: 14, color: c.textTertiary },
  subBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 16, marginBottom: 8, backgroundColor: c.primaryLight, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: c.primary + '33' },
  subTxt: { flex: 1, color: c.primary, fontSize: 16, fontWeight: '700' },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center', margin: 16, backgroundColor: c.destructiveBg, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: c.destructive + '33' },
  signOutTxt: { color: c.destructive, fontSize: 16, fontWeight: '700' },
})
