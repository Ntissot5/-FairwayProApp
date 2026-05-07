import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from './supabase'
import { Ionicons } from '@expo/vector-icons'
import { colors } from './theme'

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

  if (loading) return <View style={s.loading}><ActivityIndicator color={colors.primary} size="large" /></View>

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Training plan</Text>
        <Text style={s.sub}>{today}</Text>
      </View>
      <ScrollView style={s.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll() }} tintColor={colors.primary} />}>
        <View style={s.statsRow}>
          <View style={[s.stat, s.statGreen]}>
            <Text style={s.statValue}>{done}</Text>
          </View>
          <View style={s.stat}>
            <Text style={[s.statValue, { color: colors.textPrimary }]}>{todo}</Text>
            <Text style={s.statLabel}>To do</Text>
          </View>
          <View style={s.stat}>
            <Text style={[s.statValue, { color: colors.textPrimary }]}>{total}</Text>
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
  safe: { flex: 1, backgroundColor: colors.surfaceElevated },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { backgroundColor: colors.surface, padding: 16, paddingTop: 10, borderBottomWidth: 0.5, borderBottomColor: colors.borderStrong },
  title: { fontSize: 22, fontWeight: "800", color: colors.textPrimary },
  sub: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  scroll: { flex: 1 },
  statsRow: { flexDirection: "row", gap: 12, padding: 16 },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 16, alignItems: "center", borderWidth: 0.5, borderColor: colors.borderStrong },
  statGreen: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  statValue: { fontSize: 28, fontWeight: "800", color: colors.primary },
  statLabel: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  section: { backgroundColor: colors.surface, borderRadius: 16, margin: 16, marginTop: 0, borderWidth: 0.5, borderColor: colors.borderStrong, overflow: "hidden" },
  empty: { padding: 32, textAlign: "center", color: colors.textTertiary, fontSize: 13 },
  exRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14, borderBottomWidth: 0.5, borderBottomColor: colors.surfaceElevated },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center", marginTop: 2 },
  checkboxDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  exInfo: { flex: 1 },
  exTitle: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },
  exTitleDone: { color: colors.textTertiary, textDecorationLine: "line-through" },
  exDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
})
