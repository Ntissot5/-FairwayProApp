import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { colors } from './theme'

export default function WelcomeScreen({ navigation }) {
  const { t } = useTranslation()
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.top}>
        <Text style={styles.logo}>Fairway<Text style={styles.pro}>Pro</Text></Text>
        <Text style={styles.tagline}>{t('auth.welcome_tagline')}</Text>
      </View>
      <View style={styles.bottom}>
        <Text style={styles.question}>{t('auth.welcome_question')}</Text>
        <TouchableOpacity style={styles.btnCoach} onPress={() => navigation.navigate('Login', { mode: 'coach' })}>
          <Ionicons name="flag-outline" size={28} color={colors.primary} style={styles.btnIcon} />
          <View style={styles.btnText}>
            <Text style={styles.btnTitle}>{t('auth.i_am_coach')}</Text>
            <Text style={styles.btnDesc}>{t('auth.i_am_coach_desc')}</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnPlayer} onPress={() => navigation.navigate('Login', { mode: 'player' })}>
          <Ionicons name="person-outline" size={28} color={colors.textSecondary} style={styles.btnIcon} />
          <View style={styles.btnText}>
            <Text style={styles.btnTitle}>{t('auth.i_am_player')}</Text>
            <Text style={styles.btnDesc}>{t('auth.i_am_player_desc')}</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Login', { mode: 'coach', demo: true })}>
          <Text style={styles.demo}>{t('auth.view_demo')} →</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Plans')}>
          <Text style={styles.plans}>{t('auth.view_plans')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primary },
  top: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  logo: { fontSize: 44, fontWeight: '800', color: colors.textInverse, letterSpacing: -1 },
  pro: { color: '#4ade80' },
  tagline: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 8 },
  bottom: { backgroundColor: colors.surface, borderRadius: 28, padding: 28, margin: 12, paddingBottom: 36 },
  question: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginBottom: 20, letterSpacing: -0.5 },
  btnCoach: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primaryLight, borderRadius: 16, padding: 18, marginBottom: 12, borderWidth: 1.5, borderColor: colors.primary },
  btnPlayer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fafafa', borderRadius: 16, padding: 18, marginBottom: 12, borderWidth: 1.5, borderColor: colors.borderStrong },
  btnIcon: { marginRight: 14 },
  btnText: { flex: 1 },
  btnTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  btnDesc: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  arrow: { fontSize: 24, color: colors.textTertiary },
  demo: { textAlign: 'center', color: colors.primary, fontSize: 14, fontWeight: '600', marginTop: 16 },
  plans: { textAlign: 'center', color: colors.textTertiary, fontSize: 12, marginTop: 12 },
})
