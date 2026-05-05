import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from './supabase'
import { Ionicons } from '@expo/vector-icons'
import { useOnboarding, OnboardingTooltip } from './OnboardingContext'
import AsyncStorage from '@react-native-async-storage/async-storage'
import PlayerOnboarding from './PlayerOnboarding'
import { Svg, Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg'

const G = '#1B5E35'

export default function PlayerHomeScreen({ navigation }) {
  const [player, setPlayer] = useState(null)
  const [sessions, setSessions] = useState([])
  const [rounds, setRounds] = useState([])
  const [hcpEntries, setHcpEntries] = useState([])
  const [exercises, setExercises] = useState([])
  const [lastMessage, setLastMessage] = useState(null)
  const [nextBooking, setNextBooking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const { start: startOnboarding } = useOnboarding()

  useEffect(() => {
    fetchAll()
    checkOnboarding()
  }, [])

  const checkOnboarding = async () => {
    try {
      const seen = await AsyncStorage.getItem('player_onboarding_done')
      if (!seen) startOnboarding()
    } catch(e) {}
  }

  const finishOnboarding = async () => {
    try { await AsyncStorage.setItem('player_onboarding_done', 'true') } catch(e) {}
    setShowOnboarding(false)
  }

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: p } = await supabase.from('players').select('*').eq('player_user_id', user.id).single()
    if (p) {
      setPlayer(p)
      const { data: s } = await supabase.from('sessions').select('*').eq('player_id', p.id)
      const { data: r } = await supabase.from('rounds').select('*').eq('player_id', p.id).order('played_at', { ascending: false })
      const { data: h } = await supabase.from('handicap_history').select('*').eq('player_id', p.id).order('date', { ascending: true })
      const { data: e } = await supabase.from('exercises').select('*').eq('player_id', p.id).eq('completed', false).order('created_at', { ascending: false })
      const { data: msgs } = await supabase.from('messages').select('*').eq('player_id', p.id).eq('sender', 'coach').order('created_at', { ascending: false }).limit(1)
      const { data: bookings } = await supabase.from('lesson_bookings').select('*').eq('player_id', p.id).gte('lesson_date', new Date().toISOString().split('T')[0]).order('lesson_date', { ascending: true }).limit(1)
      setSessions(s || [])
      setRounds(r || [])
      setHcpEntries(h || [])
      setExercises(e || [])
      setLastMessage(msgs?.[0] || null)
      setNextBooking(bookings?.[0] || null)
    }
    setLoading(false)
    setRefreshing(false)
  }

  const renderHcpChart = () => {
    if (hcpEntries.length < 2) return null
    const data = hcpEntries.slice(-6)
    const values = data.map(e => e.handicap)
    const maxV = Math.max(...values) + 0.5
    const minV = Math.min(...values) - 0.5
    const range = maxV - minV || 1
    const W = 280, H = 80, padL = 8, padR = 8, padT = 8, padB = 8
    const chartW = W - padL - padR
    const chartH = H - padT - padB
    const pts = data.map((e, i) => ({
      x: padL + (i / (data.length - 1)) * chartW,
      y: padT + ((maxV - e.handicap) / range) * chartH,
    }))
    const linePath = pts.map((p, i) => (i === 0 ? "M" : "L") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" ")
    const areaPath = linePath + " L" + pts[pts.length-1].x.toFixed(1) + " " + (padT + chartH) + " L" + pts[0].x.toFixed(1) + " " + (padT + chartH) + " Z"
    const first = data[0]?.handicap
    const last = data[data.length-1]?.handicap
    const diff = (last - first).toFixed(1)
    return (
      <View style={{ marginTop: 16 }}>
        <View style={{ flexDirection: "row", gap: 16, marginBottom: 8 }}>
          <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>Début: <Text style={{ fontWeight: "700", color: "#fff" }}>{first}</Text></Text>
          <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>Actuel: <Text style={{ fontWeight: "700", color: "#fff" }}>{last}</Text></Text>
          <Text style={{ fontSize: 12, fontWeight: "700", color: parseFloat(diff) <= 0 ? "#86EFAC" : "#FCA5A5" }}>{parseFloat(diff) > 0 ? "+" : ""}{diff} pts</Text>
        </View>
        <Svg width={W} height={H}>
          <Defs>
            <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#fff" stopOpacity="0.25" />
              <Stop offset="1" stopColor="#fff" stopOpacity="0.02" />
            </LinearGradient>
          </Defs>
          <Path d={areaPath} fill="url(#grad)" />
          <Path d={linePath} stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          {pts.map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 5 : 3} fill={i === pts.length - 1 ? "#fff" : "rgba(255,255,255,0.5)"} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
          ))}
        </Svg>
      </View>
    )
  }

  if (loading) return <View style={s.loading}><ActivityIndicator color={G} size="large" /></View>


  if (!player) return (
    <SafeAreaView style={s.safe}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
        <Ionicons name="flag-outline" size={40} color={G} style={{ marginBottom: 16 }} />
        <Text style={{ fontSize: 20, fontWeight: "800", color: "#1a1a1a", textAlign: "center", marginBottom: 8 }}>Compte joueur non trouvé</Text>
        <Text style={{ fontSize: 14, color: "#6B7280", textAlign: "center" }}>Demande à ton coach de t'inviter sur FairwayPro.</Text>
      </View>
    </SafeAreaView>
  )

  const todoExercises = exercises.filter(e => !e.completed)

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll() }} tintColor={G} />}>

        {/* Header Card */}
        <View style={s.headerCard}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View>
              <Text style={s.welcome}>Welcome back</Text>
              <Text style={s.playerName}>{player.full_name}</Text>
            </View>
            <View style={s.avatar}>
              <Text style={s.avatarTxt}>{player.full_name?.charAt(0)}</Text>
            </View>
          </View>
          <View style={s.statsRow}>
            {[
              { label: "HCP", value: player.current_handicap || 0 },
              { label: "Sessions", value: sessions.length },
              { label: "Rounds", value: rounds.length },
            ].map((stat, i) => (
              <View key={i} style={s.stat}>
                <Text style={s.statValue}>{stat.value}</Text>
                <Text style={s.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
          {renderHcpChart()}
        </View>

        {/* Next booking */}
        {nextBooking && (
          <View style={s.card}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={s.cardIcon}><Ionicons name="calendar-outline" size={22} color={G} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardLabel}>PROCHAIN COURS</Text>
                <Text style={s.cardTitle}>{nextBooking.lesson_date} à {nextBooking.start_time?.slice(0,5)}</Text>
                <Text style={s.cardSub}>{nextBooking.type === 'group' ? 'Cours collectif' : 'Cours privé'}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Last message from coach */}
        {lastMessage && (
          <TouchableOpacity style={s.card} onPress={() => navigation.navigate("PlayerChat")}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={[s.cardIcon, { backgroundColor: '#E8F5EE' }]}><Ionicons name="chatbubbles-outline" size={22} color={G} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardLabel}>MESSAGE DE TON COACH</Text>
                <Text style={s.cardTitle} numberOfLines={2}>{lastMessage.content}</Text>
                <Text style={s.cardSub}>{new Date(lastMessage.created_at).toLocaleDateString('fr-FR')}</Text>
              </View>
              <Text style={{ fontSize: 20, color: '#9CA3AF' }}>›</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Exercises todo */}
        {todoExercises.length > 0 && (
          <TouchableOpacity style={s.card} onPress={() => navigation.navigate("PlayerPlan")}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={[s.cardIcon, { backgroundColor: '#FEF3C7' }]}><Ionicons name="clipboard-outline" size={22} color="#D97706" /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardLabel}>PLAN D'ENTRAÎNEMENT</Text>
                <Text style={s.cardTitle}>{todoExercises.length} exercice{todoExercises.length > 1 ? 's' : ''} à faire</Text>
                <Text style={s.cardSub} numberOfLines={1}>{todoExercises[0]?.title}</Text>
              </View>
              <Text style={{ fontSize: 20, color: '#9CA3AF' }}>›</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Add round button */}
        <TouchableOpacity style={s.addRoundBtn} onPress={() => navigation.navigate("PlayerRounds")}>
          <Text style={s.addRoundTxt}>+ Add a round</Text>
        </TouchableOpacity>

        {/* Recent rounds */}
        {rounds.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Recent rounds</Text>
            {rounds.slice(0, 3).map(r => (
              <View key={r.id} style={s.roundRow}>
                <View style={s.roundInfo}>
                  <Text style={s.roundCourse}>{r.course_name || "Golf course"}</Text>
                  <Text style={s.roundDate}>{r.played_at}</Text>
                </View>
                <Text style={s.roundScore}>{r.score}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Empty state */}
        {rounds.length === 0 && todoExercises.length === 0 && !lastMessage && (
          <View style={s.emptyState}>
            <Ionicons name="flag-outline" size={48} color={G} style={{ marginBottom: 16 }} />
            <Text style={s.emptyTitle}>Prêt à jouer ?</Text>
            <Text style={s.emptySub}>Ajoute ton premier round ou attends que ton coach t'assigne des exercices.</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8f8f8" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 },
  headerCard: { backgroundColor: G, margin: 16, borderRadius: 20, padding: 20 },
  welcome: { fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 4 },
  playerName: { fontSize: 28, fontWeight: "800", color: "#fff", letterSpacing: -0.5 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: "#fff", fontSize: 18, fontWeight: "700" },
  statsRow: { flexDirection: "row", gap: 12, marginTop: 20 },
  stat: { flex: 1, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12, padding: 12, alignItems: "center" },
  statValue: { fontSize: 24, fontWeight: "800", color: "#fff" },
  statLabel: { fontSize: 10, color: "rgba(255,255,255,0.7)", marginTop: 2, fontWeight: "600" },
  card: { backgroundColor: "#fff", borderRadius: 16, margin: 16, marginTop: 0, marginBottom: 8, padding: 16, borderWidth: 0.5, borderColor: "#E5E7EB" },
  cardIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: "#F0FAF4", alignItems: "center", justifyContent: "center" },
  cardLabel: { fontSize: 10, fontWeight: "700", color: "#9CA3AF", letterSpacing: 0.5, marginBottom: 3 },
  cardTitle: { fontSize: 14, fontWeight: "600", color: "#1a1a1a" },
  cardSub: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  addRoundBtn: { backgroundColor: G, margin: 16, marginTop: 8, marginBottom: 8, borderRadius: 14, padding: 16, alignItems: "center" },
  addRoundTxt: { color: "#fff", fontSize: 16, fontWeight: "700" },
  section: { backgroundColor: "#fff", borderRadius: 16, margin: 16, marginTop: 0, borderWidth: 0.5, borderColor: "#E5E7EB", overflow: "hidden" },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#1a1a1a", padding: 16, borderBottomWidth: 0.5, borderBottomColor: "#F0F4F0" },
  roundRow: { flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 0.5, borderBottomColor: "#F8FAF8" },
  roundInfo: { flex: 1 },
  roundCourse: { fontSize: 13, fontWeight: "500", color: "#1a1a1a" },
  roundDate: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  roundScore: { fontSize: 22, fontWeight: "800", color: G },
  emptyState: { margin: 32, alignItems: "center" },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: "#1a1a1a", marginBottom: 8 },
  emptySub: { fontSize: 14, color: "#6B7280", textAlign: "center", lineHeight: 22 },
})
