import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'

const G = '#1B5E35'

export default function CoachOnboardingWelcomeScreen({ route, navigation }) {
  const { t } = useTranslation()
  const firstName = route.params?.firstName || ''

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <View style={s.logoWrap}>
          <Ionicons name="flag" size={48} color={G} />
        </View>
        <Text style={s.title}>{t('onboarding.welcome_title', { name: firstName })}</Text>
        <Text style={s.subtitle}>{t('onboarding.welcome_subtitle')}</Text>
        <TouchableOpacity style={s.cta} onPress={() => navigation.navigate('OnboardingProfile', { firstName })}>
          <Text style={s.ctaTxt}>{t('onboarding.lets_go')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  logoWrap: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '800', color: '#1a1a1a', textAlign: 'center', letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#6B7280', textAlign: 'center', lineHeight: 24, marginBottom: 40 },
  cta: { backgroundColor: G, borderRadius: 14, paddingVertical: 18, paddingHorizontal: 48, width: '100%', alignItems: 'center' },
  ctaTxt: { color: '#fff', fontSize: 17, fontWeight: '700' },
})
