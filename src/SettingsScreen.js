import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from './supabase'

const G = '#1B5E35'

export default function SettingsScreen({ navigation }) {
  const [user, setUser] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    navigation.replace('Welcome')
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Settings</Text>
      </View>
      <ScrollView style={s.scroll}>
        <View style={s.section}>
          <Text style={s.sectionTitle}>Account</Text>
          <View style={s.row}>
            <View style={s.av}>
              <Text style={s.avTxt}>{user?.email?.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={s.info}>
              <Text style={s.email}>{user?.email}</Text>
              <Text style={s.role}>HEAD COACH</Text>
            </View>
          </View>
        </View>
        <View style={s.section}>
          <Text style={s.sectionTitle}>App</Text>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Version</Text>
            <Text style={s.infoValue}>1.0.0</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Platform</Text>
            <Text style={s.infoValue}>iOS</Text>
          </View>
        </View>
        <TouchableOpacity style={s.signOutBtn} onPress={signOut}>
          <Text style={s.signOutTxt}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f8f8' },
  header: { backgroundColor: '#fff', padding: 20, paddingTop: 10, borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
  title: { fontSize: 24, fontWeight: '800', color: '#1a1a1a', letterSpacing: -0.5 },
  scroll: { flex: 1 },
  section: { backgroundColor: '#fff', borderRadius: 16, margin: 16, marginBottom: 8, padding: 16, borderWidth: 0.5, borderColor: '#E5E7EB' },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.1, marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  av: { width: 48, height: 48, borderRadius: 24, backgroundColor: G, alignItems: 'center', justifyContent: 'center' },
  avTxt: { color: '#fff', fontSize: 18, fontWeight: '700' },
  info: { flex: 1 },
  email: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  role: { fontSize: 11, color: '#9CA3AF', marginTop: 2, letterSpacing: 0.1 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#F0F4F0' },
  infoLabel: { fontSize: 14, color: '#1a1a1a' },
  infoValue: { fontSize: 14, color: '#9CA3AF' },
  signOutBtn: { margin: 16, backgroundColor: '#FEF2F2', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#FECACA' },
  signOutTxt: { color: '#DC2626', fontSize: 16, fontWeight: '700' },
})
