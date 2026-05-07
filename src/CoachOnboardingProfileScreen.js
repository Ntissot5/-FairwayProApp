import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'

const G = '#1B5E35'

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
          <TextInput style={s.input} value={fullName} onChangeText={setFullName} placeholder="Jean Dupont" placeholderTextColor="#9CA3AF" autoFocus />

          <Text style={s.label}>{t('onboarding.city')}</Text>
          <TextInput style={s.input} value={city} onChangeText={setCity} placeholder="Lausanne" placeholderTextColor="#9CA3AF" />

          <Text style={s.label}>{t('onboarding.club_optional')}</Text>
          <TextInput style={s.input} value={club} onChangeText={setClub} placeholder="Golf Club de Lausanne" placeholderTextColor="#9CA3AF" />

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
  safe: { flex: 1, backgroundColor: '#fff' },
  scroll: { flexGrow: 1, padding: 24 },
  header: { marginBottom: 24 },
  stepBadge: { backgroundColor: '#E8F5E9', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 16 },
  stepTxt: { fontSize: 13, fontWeight: '700', color: G },
  title: { fontSize: 24, fontWeight: '800', color: '#1a1a1a', letterSpacing: -0.5, marginBottom: 6 },
  subtitle: { fontSize: 15, color: '#6B7280', lineHeight: 22 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 16 },
  input: { backgroundColor: '#F8FAF8', borderWidth: 1, borderColor: '#E0E5E0', borderRadius: 12, padding: 16, fontSize: 16, color: '#1a1a1a' },
  cta: { backgroundColor: G, borderRadius: 14, paddingVertical: 18, alignItems: 'center', marginTop: 32 },
  ctaDisabled: { opacity: 0.4 },
  ctaTxt: { color: '#fff', fontSize: 17, fontWeight: '700' },
})
