import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { colors } from './theme'

export default function CoachOnboardingWelcomeScreen({ route, navigation }) {
  const { t } = useTranslation()
  const firstName = route.params?.firstName || ''

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <View style={s.logoWrap}>
          <Ionicons name="flag" size={48} color={colors.primary} />
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
  safe: { flex: 1, backgroundColor: colors.surface },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  logoWrap: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '800', color: colors.textPrimary, textAlign: 'center', letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontSize: 16, color: colors.textSecondary, textAlign: 'center', lineHeight: 24, marginBottom: 40 },
  cta: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 18, paddingHorizontal: 48, width: '100%', alignItems: 'center' },
  ctaTxt: { color: colors.textInverse, fontSize: 17, fontWeight: '700' },
})
