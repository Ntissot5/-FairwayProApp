import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { supabase } from './supabase'
import { getBriefingSettings, saveBriefingSettings } from './utils/briefingSettings'
import { colors } from './theme'

const LANGUAGES = [
  { code: 'fr', label: 'Français', enabled: true },
  { code: 'en', label: 'English', enabled: true },
  { code: 'de', label: 'Deutsch', enabled: false },
]

const TIME_OPTIONS = ['06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00']
const PAUSE_OPTIONS = [
  { days: 1, key: 'settings.briefing.pause_1day' },
  { days: 3, key: 'settings.briefing.pause_3days' },
  { days: 7, key: 'settings.briefing.pause_7days' },
  { days: 14, key: 'settings.briefing.pause_14days' },
]

export default function SettingsScreen({ navigation }) {
  const { t, i18n } = useTranslation()
  const [user, setUser] = useState(null)
  const [briefSettings, setBriefSettings] = useState({ enabled: true, time: '06:30', paused_until: null })
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [showPausePicker, setShowPausePicker] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
    getBriefingSettings().then(setBriefSettings)
  }, [])

  const updateBriefSettings = useCallback(async (patch) => {
    const updated = { ...briefSettings, ...patch }
    setBriefSettings(updated)
    await saveBriefingSettings(updated)
  }, [briefSettings])

  const isPaused = briefSettings.paused_until && new Date(briefSettings.paused_until) > new Date()

  const signOut = async () => {
    await supabase.auth.signOut()
    navigation.replace('Welcome')
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
              <Text style={s.role}>{t('settings.head_coach')}</Text>
            </View>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('settings.language').toUpperCase()}</Text>
          {LANGUAGES.map((lang, idx) => (
            <TouchableOpacity
              key={lang.code}
              style={[s.langRow, idx < LANGUAGES.length - 1 && s.langRowBorder]}
              onPress={() => lang.enabled && i18n.changeLanguage(lang.code)}
              disabled={!lang.enabled}
              activeOpacity={lang.enabled ? 0.7 : 1}
            >
              <View style={{ flex: 1 }}>
                <Text style={[s.langLabel, !lang.enabled && s.langDisabled]}>{lang.label}</Text>
                {!lang.enabled && <Text style={s.langSoon}>{t('settings.language_de_soon')}</Text>}
              </View>
              {lang.enabled && i18n.language === lang.code && (
                <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
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

        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('settings.briefing.section_title').toUpperCase()}</Text>
          <Text style={{ fontSize: 13, color: colors.textTertiary, marginBottom: 14, marginTop: -8 }}>{t('settings.briefing.section_subtitle')}</Text>

          <View style={[s.infoRow, { paddingVertical: 12 }]}>
            <Text style={s.infoLabel}>{t('settings.briefing.enabled')}</Text>
            <Switch value={briefSettings.enabled} onValueChange={(v) => updateBriefSettings({ enabled: v })} trackColor={{ true: colors.primary }} />
          </View>

          {briefSettings.enabled && (
            <>
              <TouchableOpacity style={s.infoRow} onPress={() => setShowTimePicker(true)}>
                <Text style={s.infoLabel}>{t('settings.briefing.time')}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={s.infoValue}>{briefSettings.time}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                </View>
              </TouchableOpacity>

              <View style={[s.infoRow, { borderBottomWidth: 0 }]}>
                <Text style={s.infoLabel}>{t('settings.briefing.pause')}</Text>
                {isPaused ? (
                  <TouchableOpacity onPress={() => updateBriefSettings({ paused_until: null })} style={{ backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.warning }}>{t('settings.briefing.reactivate')}</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => setShowPausePicker(true)} style={{ backgroundColor: colors.surfaceElevated, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 0.5, borderColor: colors.borderStrong }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>{t('settings.briefing.pause')}</Text>
                  </TouchableOpacity>
                )}
              </View>
              {isPaused && (
                <Text style={{ fontSize: 12, color: colors.warning, marginTop: 4 }}>
                  {t('settings.briefing.paused_until', { date: new Date(briefSettings.paused_until).toLocaleDateString(i18n.language === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'long' }) })}
                </Text>
              )}
            </>
          )}
        </View>

        <TouchableOpacity style={s.signOutBtn} onPress={signOut}>
          <Text style={s.signOutTxt}>{t('settings.logout')}</Text>
        </TouchableOpacity>

        {/* Time Picker Modal */}
        <Modal visible={showTimePicker} transparent animationType="fade">
          <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowTimePicker(false)}>
            <View style={s.modalCard}>
              <Text style={s.modalTitle}>{t('settings.briefing.time')}</Text>
              {TIME_OPTIONS.map((time) => (
                <TouchableOpacity key={time} style={[s.modalRow, briefSettings.time === time && { backgroundColor: colors.primaryLight }]} onPress={() => { updateBriefSettings({ time }); setShowTimePicker(false) }}>
                  <Text style={[s.modalRowTxt, briefSettings.time === time && { color: colors.primary, fontWeight: '700' }]}>{time}</Text>
                  {briefSettings.time === time && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Pause Picker Modal */}
        <Modal visible={showPausePicker} transparent animationType="fade">
          <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowPausePicker(false)}>
            <View style={s.modalCard}>
              <Text style={s.modalTitle}>{t('settings.briefing.pause')}</Text>
              {PAUSE_OPTIONS.map(({ days, key }) => (
                <TouchableOpacity key={days} style={s.modalRow} onPress={() => {
                  const until = new Date()
                  until.setDate(until.getDate() + days)
                  updateBriefSettings({ paused_until: until.toISOString() })
                  setShowPausePicker(false)
                }}>
                  <Text style={s.modalRowTxt}>{t(key)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surfaceElevated },
  header: { backgroundColor: colors.surface, padding: 20, paddingTop: 10, borderBottomWidth: 0.5, borderBottomColor: colors.borderStrong },
  title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
  scroll: { flex: 1 },
  section: { backgroundColor: colors.surface, borderRadius: 16, margin: 16, marginBottom: 8, padding: 16, borderWidth: 0.5, borderColor: colors.borderStrong },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: colors.textTertiary, letterSpacing: 0.1, marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  av: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avTxt: { color: colors.textInverse, fontSize: 18, fontWeight: '700' },
  info: { flex: 1 },
  email: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  role: { fontSize: 11, color: colors.textTertiary, marginTop: 2, letterSpacing: 0.1 },
  langRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  langRowBorder: { borderBottomWidth: 0.5, borderBottomColor: colors.border },
  langLabel: { fontSize: 15, color: colors.textPrimary, fontWeight: '500' },
  langDisabled: { color: '#C4C4C4' },
  langSoon: { fontSize: 11, color: '#C4C4C4', marginTop: 2 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  infoLabel: { fontSize: 14, color: colors.textPrimary },
  infoValue: { fontSize: 14, color: colors.textTertiary },
  signOutBtn: { margin: 16, backgroundColor: colors.errorLight, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.error },
  signOutTxt: { color: colors.error, fontSize: 16, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  modalCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, width: '100%' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 },
  modalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border, borderRadius: 8, paddingHorizontal: 8 },
  modalRowTxt: { fontSize: 15, color: colors.textSecondary },
})
