import { useState, useEffect, useMemo } from 'react'
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from './supabase'
import { useTheme } from './ThemeContext'
import { useTranslation } from 'react-i18next'
import AnimatedPressable from './components/AnimatedPressable'
import AnimatedListItem from './components/AnimatedListItem'
import { CardListSkeleton } from './components/Skeleton'

export default function PlayerPlanScreen() {
  const { colors } = useTheme()
  const { t } = useTranslation()
  const s = useMemo(() => makeStyles(colors), [colors])
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

  if (loading) return <SafeAreaView style={s.safe}><View style={s.header}><Text style={s.title}>{t('playerPlan.title')}</Text></View><CardListSkeleton /></SafeAreaView>

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>{t('playerPlan.title')}</Text>
        <Text style={s.sub}>{today}</Text>
      </View>
      <ScrollView style={s.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll() }} tintColor={colors.primary} />}>
        <View style={s.statsRow}>
          <View style={[s.stat, s.statGreen]}>
            <Text style={s.statValueGreen}>{done}</Text>
            <Text style={[s.statLabel, { color: colors.primary }]}>{t('playerPlan.done')}</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statValue}>{todo}</Text>
            <Text style={s.statLabel}>{t('playerPlan.todo')}</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statValue}>{total}</Text>
            <Text style={s.statLabel}>{t('playerPlan.total')}</Text>
          </View>
        </View>
        <View style={s.section}>
          {exercises.length === 0 ? (
            <View style={s.emptyWrap}>
              <Ionicons name="clipboard-outline" size={40} color={colors.separator} />
              <Text style={s.empty}>{t('playerPlan.noExercises')}</Text>
            </View>
          ) : exercises.map((ex, i) => (
            <AnimatedListItem key={ex.id} index={i}>
              <AnimatedPressable style={s.exRow} onPress={() => toggleExercise(ex)} hapticStyle={ex.completed ? 'light' : 'medium'}>
                <View style={[s.checkbox, ex.completed && s.checkboxDone]}>
                  {ex.completed && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <View style={s.exInfo}>
                  <Text style={[s.exTitle, ex.completed && s.exTitleDone]}>{ex.title}</Text>
                  {ex.description ? <Text style={s.exDesc}>{ex.description}</Text> : null}
                </View>
              </AnimatedPressable>
            </AnimatedListItem>
          ))}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bgSecondary },
  header: { backgroundColor: c.card, padding: 16, paddingTop: 10, borderBottomWidth: 0.5, borderBottomColor: c.separator },
  title: { fontSize: 22, fontWeight: '800', color: c.text },
  sub: { fontSize: 12, color: c.textTertiary, marginTop: 2 },
  scroll: { flex: 1 },
  statsRow: { flexDirection: 'row', gap: 12, padding: 16 },
  stat: { flex: 1, backgroundColor: c.card, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 0.5, borderColor: c.separator },
  statGreen: { backgroundColor: c.primaryLight, borderColor: c.primary },
  statValueGreen: { fontSize: 28, fontWeight: '800', color: c.primary },
  statValue: { fontSize: 28, fontWeight: '800', color: c.text },
  statLabel: { fontSize: 11, color: c.textTertiary, marginTop: 2 },
  section: { backgroundColor: c.card, borderRadius: 16, margin: 16, marginTop: 0, borderWidth: 0.5, borderColor: c.separator, overflow: 'hidden' },
  emptyWrap: { padding: 40, alignItems: 'center', gap: 12 },
  empty: { textAlign: 'center', color: c.textTertiary, fontSize: 13 },
  exRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderBottomWidth: 0.5, borderBottomColor: c.separatorLight },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: c.separator, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  checkboxDone: { backgroundColor: c.primary, borderColor: c.primary },
  exInfo: { flex: 1 },
  exTitle: { fontSize: 14, fontWeight: '600', color: c.text },
  exTitleDone: { color: c.textTertiary, textDecorationLine: 'line-through' },
  exDesc: { fontSize: 12, color: c.textSecondary, marginTop: 4, lineHeight: 18 },
})
