import { useState, useMemo } from 'react'
import { View, Text, TextInput, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { supabase } from './supabase'
import { registerForPushNotifications, savePushToken } from './notifications'
import { useTheme } from './ThemeContext'
import { useTranslation } from 'react-i18next'
import AnimatedPressable from './components/AnimatedPressable'

export default function LoginScreen({ navigation, route }) {
  const { colors } = useTheme()
  const { t } = useTranslation()
  const s = useMemo(() => makeStyles(colors), [colors])
  const { mode, demo } = route.params
  const isSignup = false
  const [email, setEmail] = useState(demo ? 'demo@fairwaypro.io' : '')
  const [password, setPassword] = useState(demo ? 'FairwayDemo2026' : '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleAuth = async () => {
    if (!email || !password) { setError(t('login.errorEmpty')); return }
    if (password.length < 6) { setError(t('login.errorShort')); return }
    setLoading(true)
    setError(null)
    if (isSignup) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError(t('login.errorWrong')); setLoading(false); return }
    }
    try {
      const token = await registerForPushNotifications()
      const { data: { user } } = await supabase.auth.getUser()
      if (token && user) await savePushToken(user.id, token)
    } catch(e) {}
    setLoading(false)
    if (mode === 'coach') {
      const { data: { user } } = await supabase.auth.getUser()
      navigation.replace('CoachTabs')
    } else {
      navigation.replace('PlayerApp')
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <AnimatedPressable style={s.back} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
            <Text style={s.backTxt}>{t('common.back')}</Text>
          </AnimatedPressable>
          <View style={s.card}>
            <Text style={s.title}>{isSignup ? t('login.signup') : t('login.title')}</Text>
            <View style={s.modeRow}>
              {mode === 'coach'
                ? <MaterialCommunityIcons name="golf" size={18} color={colors.textTertiary} />
                : <Ionicons name="flag" size={18} color={colors.textTertiary} />
              }
              <Text style={s.sub}>{mode === 'coach' ? t('common.coach') : t('common.player')}</Text>
            </View>
            {error && <View style={s.errorBox}><Text style={s.errorTxt}>{error}</Text></View>}
            <TextInput style={s.input} placeholder={t('login.email')} placeholderTextColor={colors.textTertiary} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoCorrect={false} />
            <TextInput style={s.input} placeholder={isSignup ? t('login.passwordMin') : t('login.password')} placeholderTextColor={colors.textTertiary} value={password} onChangeText={setPassword} secureTextEntry />
            <AnimatedPressable style={[s.btn, loading && s.btnDisabled]} onPress={handleAuth} disabled={loading} hapticStyle="medium">
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>{isSignup ? t('login.submitSignup') : t('login.submit')}</Text>}
            </AnimatedPressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  scroll: { flexGrow: 1, padding: 20 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 10, marginBottom: 10 },
  backTxt: { fontSize: 16, color: c.primary, fontWeight: '600' },
  card: { flex: 1, justifyContent: 'center', paddingVertical: 40 },
  title: { fontSize: 28, fontWeight: '800', color: c.text, letterSpacing: -0.8, marginBottom: 6 },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 28 },
  sub: { fontSize: 14, color: c.textTertiary },
  errorBox: { backgroundColor: c.destructiveBg, borderRadius: 10, padding: 12, marginBottom: 14 },
  errorTxt: { color: c.destructive, fontSize: 13 },
  input: { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 12, padding: 16, fontSize: 15, color: c.text, marginBottom: 12 },
  btn: { backgroundColor: c.primary, borderRadius: 14, padding: 18, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.7 },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
