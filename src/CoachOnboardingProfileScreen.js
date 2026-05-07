import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { colors } from './theme'

export default function CoachOnboardingProfileScreen({ route, navigation }) {
  const { t } = useTranslation()
  const [fullName, setFullName] = useState(route.params?.firstName || '')
  const [city, setCity] = useState('')
  const [club, setClub] = useState('')

  const canContinue = fullName.trim().length > 0 && city.trim().length > 0

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.header}>
            <View style={s.stepBadge}><Text style={s.stepTxt}>1/3</Text></View>
            <Text style={s.title}>{t('onboarding.profile_title')}</Text>
            <Text style={s.subtitle}>{t('onboarding.profile_subtitle')}</Text>
          </View>

          <Text style={s.label}>{t('onboarding.full_name')}</Text>
          <TextInput style={s.input} value={fullName} onChangeText={setFullName} placeholder="Jean Dupont" placeholderTextColor={colors.textTertiary} autoFocus />

          <Text style={s.label}>{t('onboarding.city')}</Text>
          <TextInput style={s.input} value={city} onChangeText={setCity} placeholder="Lausanne" placeholderTextColor={colors.textTertiary} />

          <Text style={s.label}>{t('onboarding.club_optional')}</Text>
          <TextInput style={s.input} value={club} onChangeText={setClub} placeholder="Golf Club de Lausanne" placeholderTextColor={colors.textTertiary} />

          <TouchableOpacity
            style={[s.cta, !canContinue && s.ctaDisabled]}
            onPress={() => navigation.navigate('OnboardingFirstPlayer', { fullName: fullName.trim(), city: city.trim(), club: club.trim() })}
            disabled={!canContinue}
          >
            <Text style={s.ctaTxt}>{t('onboarding.continue')}</Text>
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
  cta: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 18, alignItems: 'center', marginTop: 32 },
  ctaDisabled: { opacity: 0.4 },
  ctaTxt: { color: colors.textInverse, fontSize: 17, fontWeight: '700' },
})
