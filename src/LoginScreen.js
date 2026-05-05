import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from './supabase'
import { registerForPushNotifications, savePushToken } from './notifications'

const G = '#1B5E35'

export default function LoginScreen({ navigation, route }) {
  const { mode, demo } = route.params
  const [isSignup, setIsSignup] = useState(false)
  const [email, setEmail] = useState(demo ? 'demo@fairwaypro.io' : '')
  const [password, setPassword] = useState(demo ? 'FairwayDemo2026' : '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleAuth = async () => {
    if (!email || !password) { setError('Remplis tous les champs'); return }
    if (password.length < 6) { setError('Mot de passe trop court (min 6)'); return }
    setLoading(true)
    setError(null)
    if (isSignup) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError('Email ou mot de passe incorrect'); setLoading(false); return }
    }
    // Save push token after login
    try {
      const token = await registerForPushNotifications()
      const { data: { user } } = await supabase.auth.getUser()
      if (token && user) await savePushToken(user.id, token)
    } catch(e) {}
    setLoading(false)
    if (mode === 'coach') {
      navigation.replace('CoachTabs')
    } else {
      navigation.replace('PlayerApp')
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
            <Text style={styles.backTxt}>‹ Retour</Text>
          </TouchableOpacity>
          <View style={styles.card}>
            <Text style={styles.title}>{isSignup ? 'Créer un compte' : 'Connexion'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Ionicons name={mode === 'coach' ? 'flag-outline' : 'person-outline'} size={16} color="#9CA3AF" /><Text style={styles.sub}>{mode === 'coach' ? 'Coach' : 'Joueur'}</Text></View>
            {error && <View style={styles.errorBox}><Text style={styles.errorTxt}>{error}</Text></View>}
            <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#9CA3AF" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoCorrect={false} />
            <TextInput style={styles.input} placeholder={isSignup ? 'Mot de passe (min. 6 caractères)' : 'Mot de passe'} placeholderTextColor="#9CA3AF" value={password} onChangeText={setPassword} secureTextEntry />
            <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleAuth} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTxt}>{isSignup ? 'Créer mon compte →' : 'Se connecter →'}</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setIsSignup(!isSignup); setError(null) }}>
              <Text style={styles.switch}>{isSignup ? 'Déjà un compte ? Se connecter' : 'Pas de compte ? Créer un compte'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  scroll: { flexGrow: 1, padding: 20 },
  back: { paddingVertical: 10, marginBottom: 10 },
  backTxt: { fontSize: 16, color: G, fontWeight: '600' },
  card: { flex: 1, justifyContent: 'center', paddingVertical: 40 },
  title: { fontSize: 28, fontWeight: '800', color: '#1a1a1a', letterSpacing: -0.8, marginBottom: 6 },
  sub: { fontSize: 14, color: '#9CA3AF', marginBottom: 28 },
  errorBox: { backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, marginBottom: 14 },
  errorTxt: { color: '#DC2626', fontSize: 13 },
  input: { backgroundColor: '#F8FAF8', borderWidth: 1, borderColor: '#E0E5E0', borderRadius: 12, padding: 16, fontSize: 15, color: '#1a1a1a', marginBottom: 12 },
  btn: { backgroundColor: G, borderRadius: 14, padding: 18, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.7 },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  switch: { textAlign: 'center', color: G, fontSize: 14, fontWeight: '500', marginTop: 18 },
})
