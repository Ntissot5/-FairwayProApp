import { useState, useEffect, useMemo } from 'react'
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Svg, Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg'
import { supabase } from './supabase'
import { useOnboarding } from './OnboardingContext'
import AsyncStorage from '@react-native-async-storage/async-storage'
import PlayerOnboarding from './PlayerOnboarding'
import { useTheme } from './ThemeContext'
import { useTranslation } from 'react-i18next'
import AnimatedPressable from './components/AnimatedPressable'
import { DashboardSkeleton } from './components/Skeleton'

export default function PlayerHomeScreen({ navigation }) {
  const { colors, isDark } = useTheme()
  const { t } = useTranslation()
  const s = useMemo(() => makeStyles(colors, isDark), [colors, isDark])
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

  useEffect(() => { fetchAll(); checkOnboarding() }, [])

  const checkOnboarding = async () => {
    try { const seen = await AsyncStorage.getItem('player_onboarding_done'); if (!seen) startOnboarding() } catch(e) {}
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
      const [sRes, rRes, hRes, eRes, mRes, bRes] = await Promise.all([
        supabase.from('sessions').select('*').eq('player_id', p.id),
        supabase.from('rounds').select('*').eq('player_id', p.id).order('played_at', { ascending: false }),
        supabase.from('handicap_history').select('*').eq('player_id', p.id).order('date', { ascending: true }),
        supabase.from('exercises').select('*').eq('player_id', p.id).eq('completed', false).order('created_at', { ascending: false }),
        supabase.from('messages').select('*').eq('player_id', p.id).eq('sender', 'coach').order('created_at', { ascending: false }).limit(1),
        supabase.from('lesson_bookings').select('*').eq('player_id', p.id).gte('lesson_date', new Date().toISOString().split('T')[0]).order('lesson_date', { ascending: true }).limit(1),
      ])
      setSessions(sRes.data || []); setRounds(rRes.data || []); setHcpEntries(hRes.data || [])
      setExercises(eRes.data || []); setLastMessage(mRes.data?.[0] || null); setNextBooking(bRes.data?.[0] || null)
    }
    setLoading(false); setRefreshing(false)
  }

  const renderHcpChart = () => {
    if (hcpEntries.length < 2) return null
    const data = hcpEntries.slice(-6)
    const values = data.map(e => e.handicap)
    const maxV = Math.max(...values) + 0.5, minV = Math.min(...values) - 0.5, range = maxV - minV || 1
    const W = 280, H = 80, padL = 8, padR = 8, padT = 8, padB = 8
    const chartW = W - padL - padR, chartH = H - padT - padB
    const pts = data.map((e, i) => ({ x: padL + (i / (data.length - 1)) * chartW, y: padT + ((maxV - e.handicap) / range) * chartH }))
    const linePath = pts.map((p, i) => (i === 0 ? "M" : "L") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" ")
    const areaPath = linePath + " L" + pts[pts.length-1].x.toFixed(1) + " " + (padT + chartH) + " L" + pts[0].x.toFixed(1) + " " + (padT + chartH) + " Z"
    const first = data[0]?.handicap, last = data[data.length-1]?.handicap, diff = (last - first).toFixed(1)
    return (
      <View style={{ marginTop: 16 }}>
        <View style={{ flexDirection: "row", gap: 16, marginBottom: 8 }}>
          <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{t('playerHome.start')}: <Text style={{ fontWeight: "700", color: "#fff" }}>{first}</Text></Text>
          <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{t('playerHome.current')}: <Text style={{ fontWeight: "700", color: "#fff" }}>{last}</Text></Text>
          <Text style={{ fontSize: 12, fontWeight: "700", color: parseFloat(diff) <= 0 ? "#86EFAC" : "#FCA5A5" }}>{parseFloat(diff) > 0 ? "+" : ""}{diff} {t('playerHome.pts')}</Text>
        </View>
        <Svg width={W} height={H}>
          <Defs><LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#fff" stopOpacity="0.25" /><Stop offset="1" stopColor="#fff" stopOpacity="0.02" /></LinearGradient></Defs>
          <Path d={areaPath} fill="url(#grad)" />
          <Path d={linePath} stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          {pts.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 5 : 3} fill={i === pts.length - 1 ? "#fff" : "rgba(255,255,255,0.5)"} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />)}
        </Svg>
      </View>
    )
  }

  if (loading) return <SafeAreaView style={s.safe}><DashboardSkeleton /></SafeAreaView>

  if (!player) return (
    <SafeAreaView style={s.safe}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
        <Ionicons name="flag-outline" size={48} color={colors.separator} />
        <Text style={{ fontSize: 20, fontWeight: "800", color: colors.text, textAlign: "center" }}>{t('playerHome.notFound')}</Text>
        <Text style={{ fontSize: 14, color: colors.textTertiary, textAlign: "center" }}>{t('playerHome.notFoundSub')}</Text>
      </View>
    </SafeAreaView>
  )

  const todoExercises = exercises.filter(e => !e.completed)

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll() }} tintColor={colors.primary} />}>
        <View style={s.headerCard}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View>
              <Text style={s.welcome}>{t('playerHome.welcomeBack')}</Text>
              <Text style={s.playerName}>{player.full_name}</Text>
            </View>
            <View style={s.avatar}><Text style={s.avatarTxt}>{player.full_name?.charAt(0)}</Text></View>
          </View>
          <View style={s.statsRow}>
            {[{ label: t('playerHome.hcp'), value: player.current_handicap || 0 }, { label: t('playerHome.sessions'), value: sessions.length }, { label: t('playerHome.rounds'), value: rounds.length }].map((stat, i) => (
              <View key={i} style={s.stat}><Text style={s.statValue}>{stat.value}</Text><Text style={s.statLabel}>{stat.label}</Text></View>
            ))}
          </View>
          {renderHcpChart()}
        </View>

        {nextBooking && (
          <View style={s.card}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={s.cardIcon}><Ionicons name="calendar" size={22} color={colors.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardLabel}>{t('playerHome.nextLesson')}</Text>
                <Text style={s.cardTitle}>{nextBooking.lesson_date} a {nextBooking.start_time?.slice(0,5)}</Text>
                <Text style={s.cardSub}>{nextBooking.type === 'group' ? t('playerHome.groupLesson') : t('playerHome.privateLesson')}</Text>
              </View>
            </View>
          </View>
        )}

        {lastMessage && (
          <AnimatedPressable style={s.card} onPress={() => navigation.navigate("PlayerChat")} haptic={false}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={[s.cardIcon, { backgroundColor: colors.primaryLight }]}><Ionicons name="chatbubble" size={22} color={colors.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardLabel}>{t('playerHome.coachMessage')}</Text>
                <Text style={s.cardTitle} numberOfLines={2}>{lastMessage.content}</Text>
                <Text style={s.cardSub}>{new Date(lastMessage.created_at).toLocaleDateString('fr-FR')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </View>
          </AnimatedPressable>
        )}

        {todoExercises.length > 0 && (
          <AnimatedPressable style={s.card} onPress={() => navigation.navigate("PlayerPlan")} haptic={false}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={[s.cardIcon, { backgroundColor: colors.warningBg }]}><Ionicons name="clipboard" size={22} color={colors.warning} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardLabel}>{t('playerHome.trainingPlan')}</Text>
                <Text style={s.cardTitle}>{t('playerHome.exercisesToDo', { count: todoExercises.length })}</Text>
                <Text style={s.cardSub} numberOfLines={1}>{todoExercises[0]?.title}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </View>
          </AnimatedPressable>
        )}

        <AnimatedPressable style={s.addRoundBtn} onPress={() => navigation.navigate("PlayerRounds")} hapticStyle="medium">
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={s.addRoundTxt}>{t('playerHome.addRound')}</Text>
        </AnimatedPressable>

        {rounds.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('playerHome.recentRounds')}</Text>
            {rounds.slice(0, 3).map(r => (
              <View key={r.id} style={s.roundRow}>
                <View style={s.roundInfo}>
                  <Text style={s.roundCourse}>{r.course_name || t('playerHome.golfCourse')}</Text>
                  <Text style={s.roundDate}>{r.played_at}</Text>
                </View>
                <Text style={s.roundScore}>{r.score}</Text>
              </View>
            ))}
          </View>
        )}

        {rounds.length === 0 && todoExercises.length === 0 && !lastMessage && (
          <View style={s.emptyState}>
            <Ionicons name="golf-outline" size={48} color={colors.separator} />
            <Text style={s.emptyTitle}>{t('playerHome.readyToPlay')}</Text>
            <Text style={s.emptySub}>{t('playerHome.readyToPlaySub')}</Text>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (c, isDark) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bgSecondary },
  scroll: { flex: 1 },
  headerCard: { backgroundColor: isDark ? '#0A2E1A' : c.primary, margin: 16, borderRadius: 20, padding: 20 },
  welcome: { fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 4 },
  playerName: { fontSize: 28, fontWeight: "800", color: "#fff", letterSpacing: -0.5 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: "#fff", fontSize: 18, fontWeight: "700" },
  statsRow: { flexDirection: "row", gap: 12, marginTop: 20 },
  stat: { flex: 1, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12, padding: 12, alignItems: "center" },
  statValue: { fontSize: 24, fontWeight: "800", color: "#fff" },
  statLabel: { fontSize: 10, color: "rgba(255,255,255,0.7)", marginTop: 2, fontWeight: "600" },
  card: { backgroundColor: c.card, borderRadius: 16, margin: 16, marginTop: 0, marginBottom: 8, padding: 16, borderWidth: 0.5, borderColor: c.separator },
  cardIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: c.successBg, alignItems: "center", justifyContent: "center" },
  cardLabel: { fontSize: 10, fontWeight: "700", color: c.textTertiary, letterSpacing: 0.5, marginBottom: 3 },
  cardTitle: { fontSize: 14, fontWeight: "600", color: c.text },
  cardSub: { fontSize: 12, color: c.textTertiary, marginTop: 2 },
  addRoundBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: c.primary, margin: 16, marginTop: 8, marginBottom: 8, borderRadius: 14, padding: 16 },
  addRoundTxt: { color: "#fff", fontSize: 16, fontWeight: "700" },
  section: { backgroundColor: c.card, borderRadius: 16, margin: 16, marginTop: 0, borderWidth: 0.5, borderColor: c.separator, overflow: "hidden" },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: c.text, padding: 16, borderBottomWidth: 0.5, borderBottomColor: c.separatorLight },
  roundRow: { flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 0.5, borderBottomColor: c.separatorLight },
  roundInfo: { flex: 1 },
  roundCourse: { fontSize: 13, fontWeight: "500", color: c.text },
  roundDate: { fontSize: 11, color: c.textTertiary, marginTop: 2 },
  roundScore: { fontSize: 22, fontWeight: "800", color: c.primary },
  emptyState: { margin: 32, alignItems: "center", gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: c.text },
  emptySub: { fontSize: 14, color: c.textTertiary, textAlign: "center", lineHeight: 22 },
})
