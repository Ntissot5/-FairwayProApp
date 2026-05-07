import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { supabase } from './supabase'
import { colors } from './theme'

export default function LoginScreen({ navigation, route }) {
  const { t } = useTranslation()
  const { mode, demo } = route.params
  const [isSignup, setIsSignup] = useState(false)
  const [email, setEmail] = useState(demo ? 'demo@fairwaypro.io' : '')
  const [password, setPassword] = useState(demo ? 'FairwayDemo2026' : '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleAuth = async () => {
    if (!email || !password) { setError(t('auth.fields_required')); return }
    if (password.length < 6) { setError(t('auth.password_too_short')); return }
    setLoading(true)
    setError(null)
    if (isSignup) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError(t('auth.login_error')); setLoading(false); return }
    }
    setLoading(false)
    if (mode === 'coach') {
      const { data: { user } } = await supabase.auth.getUser()
      const isOnboarded = !!user?.user_metadata?.onboarded_at
      if (isOnboarded) {
        navigation.replace('CoachTabs')
      } else {
        const firstName = user?.email?.split('@')[0] || ''
        navigation.replace('OnboardingWelcome', { firstName })
      }
    } else {
      navigation.replace('PlayerApp')
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
            <Text style={styles.backTxt}>‹ {t('common.back')}</Text>
          </TouchableOpacity>
          <View style={styles.card}>
            <Text style={styles.title}>{isSignup ? t('auth.signup_button') : t('auth.login_button')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Ionicons name={mode === 'coach' ? 'flag-outline' : 'person-outline'} size={16} color={colors.textTertiary} /><Text style={styles.sub}>{mode === 'coach' ? t('auth.coach') : t('auth.player')}</Text></View>
            {error && <View style={styles.errorBox}><Text style={styles.errorTxt}>{error}</Text></View>}
            <TextInput style={styles.input} placeholder={t('auth.email')} placeholderTextColor={colors.textTertiary} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoCorrect={false} />
            <TextInput style={styles.input} placeholder={t('auth.password')} placeholderTextColor={colors.textTertiary} value={password} onChangeText={setPassword} secureTextEntry />
            <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleAuth} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTxt}>{isSignup ? t('auth.signup_button') : t('auth.login_button')} →</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setIsSignup(!isSignup); setError(null) }}>
              <Text style={styles.switch}>{isSignup ? t('auth.login_button') : t('auth.signup_button')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  scroll: { flexGrow: 1, padding: 20 },
  back: { paddingVertical: 10, marginBottom: 10 },
  backTxt: { fontSize: 16, color: colors.primary, fontWeight: '600' },
  card: { flex: 1, justifyContent: 'center', paddingVertical: 40 },
  title: { fontSize: 28, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.8, marginBottom: 6 },
  sub: { fontSize: 14, color: colors.textTertiary, marginBottom: 28 },
  errorBox: { backgroundColor: colors.errorLight, borderRadius: 10, padding: 12, marginBottom: 14 },
  errorTxt: { color: colors.error, fontSize: 13 },
  input: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 12, padding: 16, fontSize: 15, color: colors.textPrimary, marginBottom: 12 },
  btn: { backgroundColor: colors.primary, borderRadius: 14, padding: 18, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.7 },
  btnTxt: { color: colors.textInverse, fontSize: 16, fontWeight: '700' },
  switch: { textAlign: 'center', color: colors.primary, fontSize: 14, fontWeight: '500', marginTop: 18 },
})
