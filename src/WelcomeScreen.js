import { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { useTheme } from './ThemeContext'
import { useTranslation } from 'react-i18next'
import AnimatedPressable from './components/AnimatedPressable'

export default function WelcomeScreen({ navigation }) {
  const { colors, isDark } = useTheme()
  const { t } = useTranslation()
  const s = useMemo(() => makeStyles(colors, isDark), [colors, isDark])

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.top}>
        <Text style={s.logo}>Fairway<Text style={s.pro}>Pro</Text></Text>
        <Text style={s.tagline}>{t('welcome.tagline')}</Text>
      </View>
      <View style={s.bottom}>
        <Text style={s.question}>{t('welcome.question')}</Text>
        <AnimatedPressable style={s.btnCoach} onPress={() => navigation.navigate('Login', { mode: 'coach' })}>
          <MaterialCommunityIcons name="golf" size={28} color={colors.primary} />
          <View style={s.btnText}>
            <Text style={s.btnTitle}>{t('welcome.coach')}</Text>
            <Text style={s.btnDesc}>{t('welcome.coachDesc')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
        </AnimatedPressable>
        <AnimatedPressable style={s.btnPlayer} onPress={() => navigation.navigate('Login', { mode: 'player' })}>
          <Ionicons name="flag" size={28} color={colors.primary} />
          <View style={s.btnText}>
            <Text style={s.btnTitle}>{t('welcome.player')}</Text>
            <Text style={s.btnDesc}>{t('welcome.playerDesc')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
        </AnimatedPressable>
        <AnimatedPressable haptic={false} onPress={() => navigation.navigate('Login', { mode: 'coach', demo: true })}>
          <Text style={s.demo}>{t('welcome.demo')}</Text>
        </AnimatedPressable>
      </View>
    </SafeAreaView>
  )
}

const makeStyles = (c, isDark) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: isDark ? '#0A2E1A' : c.primary },
  top: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  logo: { fontSize: 44, fontWeight: '800', color: '#fff', letterSpacing: -1 },
  pro: { color: '#4ade80' },
  tagline: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 8 },
  bottom: { backgroundColor: c.card, borderRadius: 28, padding: 28, margin: 12, paddingBottom: 36 },
  question: { fontSize: 22, fontWeight: '800', color: c.text, marginBottom: 20, letterSpacing: -0.5 },
  btnCoach: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.primaryLight, borderRadius: 16, padding: 18, marginBottom: 12, borderWidth: 1.5, borderColor: c.primary },
  btnPlayer: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.bgSecondary, borderRadius: 16, padding: 18, marginBottom: 12, borderWidth: 1.5, borderColor: c.separator },
  btnText: { flex: 1, marginLeft: 14 },
  btnTitle: { fontSize: 16, fontWeight: '700', color: c.text },
  btnDesc: { fontSize: 12, color: c.textTertiary, marginTop: 2 },
  demo: { textAlign: 'center', color: c.primary, fontSize: 14, fontWeight: '600', marginTop: 16 },
})
