import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { supabase } from './supabase'
import { colors } from './theme'

const LEVELS = ['beginner', 'intermediate', 'advanced', 'competition']
const LEVEL_TO_INT = { beginner: 1, intermediate: 2, advanced: 3, competition: 4 }

export default function CoachOnboardingFirstPlayerScreen({ route, navigation }) {
  const { t } = useTranslation()
  const { fullName, city, club } = route.params || {}
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [level, setLevel] = useState('intermediate')
  const [hcp, setHcp] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)

  const canContinue = firstName.trim().length > 0 && lastName.trim().length > 0

  const handleAdd = async () => {
    if (!canContinue) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    const parsedHcp = hcp ? parseFloat(hcp) : NaN
    const payload = {
      coach_id: user.id,
      full_name: `${firstName.trim()} ${lastName.trim()}`,
      current_level: LEVEL_TO_INT[level] || null,
      current_handicap: isNaN(parsedHcp) ? null : parsedHcp,
      email: email.trim() || null,
    }
    const { data, error } = await supabase.from('players').insert(payload).select().single()

    if (error) {
      console.error('[Onboarding] Insert player failed:', error)
      Alert.alert('Erreur', error.message)
      setSaving(false)
      return
    }

    if (!data) {
      console.error('[Onboarding] INSERT returned no data')
      Alert.alert('Erreur', 'Création échouée')
      setSaving(false)
      return
    }

    navigation.navigate('OnboardingTutorial', { fullName, city, club, playerFirstName: firstName.trim() })
    setSaving(false)
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.header}>
            <View style={s.stepBadge}><Text style={s.stepTxt}>2/3</Text></View>
            <Text style={s.title}>{t('onboarding.first_player_title')}</Text>
            <Text style={s.subtitle}>{t('onboarding.first_player_subtitle')}</Text>
          </View>

          <Text style={s.label}>{t('onboarding.player_firstname')}</Text>
          <TextInput style={s.input} value={firstName} onChangeText={setFirstName} placeholder="Andrea" placeholderTextColor={colors.textTertiary} autoFocus />

          <Text style={s.label}>{t('onboarding.player_lastname')}</Text>
          <TextInput style={s.input} value={lastName} onChangeText={setLastName} placeholder="Rossi" placeholderTextColor={colors.textTertiary} />

          <Text style={s.label}>{t('onboarding.player_level')}</Text>
          <View style={s.levelRow}>
            {LEVELS.map(l => (
              <TouchableOpacity key={l} style={[s.levelChip, level === l && s.levelChipActive]} onPress={() => setLevel(l)}>
                <Text style={[s.levelChipTxt, level === l && { color: colors.textInverse }]}>{t(`onboarding.level_${l}`)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.label}>{t('onboarding.player_hcp_optional')}</Text>
          <TextInput style={s.input} value={hcp} onChangeText={setHcp} placeholder="12.5" placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" />

          <Text style={s.label}>{t('onboarding.player_email_optional')}</Text>
          <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="andrea@email.com" placeholderTextColor={colors.textTertiary} keyboardType="email-address" autoCapitalize="none" />

          <TouchableOpacity
            style={[s.cta, (!canContinue || saving) && s.ctaDisabled]}
            onPress={handleAdd}
            disabled={!canContinue || saving}
          >
            {saving ? <ActivityIndicator color={colors.textInverse} /> : <Text style={s.ctaTxt}>{t('onboarding.add_player')}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  scroll: { flexGrow: 1, padding: 24 },
  header: { marginBottom: 24 },
  stepBadge: { backgroundColor: colors.primaryLight, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 16 },
  stepTxt: { fontSize: 13, fontWeight: '700', color: colors.primary },
  title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 6 },
  subtitle: { fontSize: 15, color: colors.textSecondary, lineHeight: 22 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: 16 },
  input: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 12, padding: 16, fontSize: 16, color: colors.textPrimary },
  levelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  levelChip: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  levelChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  levelChipTxt: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  cta: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 18, alignItems: 'center', marginTop: 32 },
  ctaDisabled: { opacity: 0.4 },
  ctaTxt: { color: colors.textInverse, fontSize: 17, fontWeight: '700' },
})
