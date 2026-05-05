import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from './supabase'
import { Ionicons } from '@expo/vector-icons'

const G = '#1B5E35'

export default function PlayerPlanScreen() {
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: player } = await supabase.from('players').select('id').eq('player_user_id', user.id).single()
    if (player) {
      const { data: e } = await supabase.from('exercises').select('*').eq('player_id', player.id).order('created_at', { ascending: false })
      setExercises(e || [])
    }
    setLoading(false)
    setRefreshing(false)
  }

  const toggleExercise = async (ex) => {
    await supabase.from('exercises').update({ completed: !ex.completed }).eq('id', ex.id)
    fetchAll()
  }

  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
  const todo = exercises.filter(e => !e.completed).length
  const total = exercises.length
  const done = total - todo

  if (loading) return <View style={s.loading}><ActivityIndicator color={G} size="large" /></View>

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Training plan</Text>
        <Text style={s.sub}>{today}</Text>
      </View>
      <ScrollView style={s.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll() }} tintColor={G} />}>
        <View style={s.statsRow}>
          <View style={[s.stat, s.statGreen]}>
            <Text style={s.statValue}>{done}</Text>
          </View>
          <View style={s.stat}>
            <Text style={[s.statValue, { color: "#1a1a1a" }]}>{todo}</Text>
            <Text style={s.statLabel}>To do</Text>
          </View>
          <View style={s.stat}>
            <Text style={[s.statValue, { color: "#1a1a1a" }]}>{total}</Text>
            <Text style={s.statLabel}>Total</Text>
          </View>
        </View>
        <View style={s.section}>
          {exercises.length === 0 ? (
            <Text style={s.empty}>No exercises this week</Text>
          ) : exercises.map(ex => (
            <TouchableOpacity key={ex.id} style={s.exRow} onPress={() => toggleExercise(ex)}>
              <View style={[s.checkbox, ex.completed && s.checkboxDone]}>
                {ex.completed && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <View style={s.exInfo}>
                <Text style={[s.exTitle, ex.completed && s.exTitleDone]}>{ex.title}</Text>
                {ex.description ? <Text style={s.exDesc}>{ex.description}</Text> : null}
              </View>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8f8f8" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { backgroundColor: "#fff", padding: 16, paddingTop: 10, borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB" },
  title: { fontSize: 22, fontWeight: "800", color: "#1a1a1a" },
  sub: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  scroll: { flex: 1 },
  statsRow: { flexDirection: "row", gap: 12, padding: 16 },
  stat: { flex: 1, backgroundColor: "#fff", borderRadius: 14, padding: 16, alignItems: "center", borderWidth: 0.5, borderColor: "#E5E7EB" },
  statGreen: { backgroundColor: "#E8F5EE", borderColor: G },
  statValue: { fontSize: 28, fontWeight: "800", color: G },
  statLabel: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  section: { backgroundColor: "#fff", borderRadius: 16, margin: 16, marginTop: 0, borderWidth: 0.5, borderColor: "#E5E7EB", overflow: "hidden" },
  empty: { padding: 32, textAlign: "center", color: "#9CA3AF", fontSize: 13 },
  exRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14, borderBottomWidth: 0.5, borderBottomColor: "#F8FAF8" },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "#E5E7EB", alignItems: "center", justifyContent: "center", marginTop: 2 },
  checkboxDone: { backgroundColor: G, borderColor: G },
  exInfo: { flex: 1 },
  exTitle: { fontSize: 14, fontWeight: "600", color: "#1a1a1a" },
  exTitleDone: { color: "#9CA3AF", textDecorationLine: "line-through" },
  exDesc: { fontSize: 12, color: "#6B7280", marginTop: 4, lineHeight: 18 },
})
