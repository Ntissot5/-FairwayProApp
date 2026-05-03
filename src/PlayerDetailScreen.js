import { useState, useEffect, useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, TextInput, Alert, Share } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import DateTimePicker from '@react-native-community/datetimepicker'
import { Svg, Path, Circle, Text as SvgText, Line, Defs, LinearGradient, Stop } from 'react-native-svg'
import { supabase } from './supabase'
import { useTheme } from './ThemeContext'
import { useTranslation } from 'react-i18next'
import AnimatedPressable from './components/AnimatedPressable'
import AnimatedListItem from './components/AnimatedListItem'
import Skeleton, { CardListSkeleton } from './components/Skeleton'

export default function PlayerDetailScreen({ route, navigation }) {
  const { player: initialPlayer } = route.params
  const { colors, isDark } = useTheme()
  const { t } = useTranslation()
  const s = useMemo(() => makeStyles(colors), [colors])

  const [player, setPlayer] = useState(initialPlayer)
  const [sessions, setSessions] = useState([])
  const [exercises, setExercises] = useState([])
  const [hcpEntries, setHcpEntries] = useState([])
  const [rounds, setRounds] = useState([])
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [generating, setGenerating] = useState(null)
  const [newHcp, setNewHcp] = useState("")
  const [newHcpDate, setNewHcpDate] = useState(new Date().toISOString().split("T")[0])
  const [showHcpInput, setShowHcpInput] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const { data: ss } = await supabase.from("sessions").select("*").eq("player_id", player.id).order("session_date", { ascending: false })
    const { data: e } = await supabase.from("exercises").select("*").eq("player_id", player.id).order("created_at", { ascending: false })
    const { data: h } = await supabase.from("handicap_history").select("*").eq("player_id", player.id).order("date", { ascending: true })
    const { data: r } = await supabase.from("rounds").select("*").eq("player_id", player.id).order("played_at", { ascending: false })
    const { data: v } = await supabase.from("swing_videos").select("*").eq("player_id", player.id).order("created_at", { ascending: false })
    setSessions(ss || [])
    setExercises(e || [])
    setHcpEntries(h || [])
    setRounds(r || [])
    setVideos(v || [])
    setLoading(false)
    setRefreshing(false)
  }

  const invitePlayer = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: existing } = await supabase.from('player_invites').select('token').eq('player_id', player.id).eq('used', false).single()
      let token = existing?.token
      if (!token) {
        const { data: invite } = await supabase.from('player_invites').insert({ coach_id: user.id, player_id: player.id }).select('token').single()
        token = invite?.token
      }
      const link = 'https://fairwaypro.io/join/' + token
      await Share.share({
        message: 'Salut ' + player.full_name + ' ! Ton coach t\'invite sur FairwayPro. Telecharge l\'app et utilise ce lien pour rejoindre ton espace : ' + link,
        title: 'Invitation FairwayPro'
      })
    } catch(e) { Alert.alert(t('common.error'), e.message) }
  }

  const addHcpEntry = async () => {
    if (!newHcp) return
    await supabase.from("handicap_history").insert({ player_id: player.id, handicap: parseFloat(newHcp), date: newHcpDate })
    await supabase.from("players").update({ current_handicap: parseFloat(newHcp) }).eq("id", player.id)
    setNewHcp("")
    setShowHcpInput(false)
    fetchAll()
  }

  const generateAIPlan = async (session) => {
    if (!player) return
    setGenerating(session.id)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const response = await fetch('https://aqdifzgqfemfdcigxsgw.supabase.co/functions/v1/claude-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 500, messages: [{ role: 'user', content: 'Generate 3 golf training exercises. Return ONLY a JSON array: [{"title":"...","description":"..."}] Player: ' + player.full_name + ', HCP: ' + player.current_handicap + ', Notes: ' + (session.notes || 'General') }] })
      })
      const data = await response.json()
      const text = data.content?.[0]?.text || '[]'
      const clean = text.replace(/```json|```/g, '').trim()
      const exs = JSON.parse(clean)
      for (const ex of exs) {
        await supabase.from('exercises').insert({ player_id: player.id, coach_id: user.id, title: ex.title, description: ex.description, completed: false })
      }
      Alert.alert(t('sessions.planGenerated'), t('sessions.exercisesAdded', { name: player.full_name }))
    fetchAll()
    } catch(e) { Alert.alert(t('common.error'), e.message) }
    setGenerating(null)
  }

  const uploadVideo = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== "granted") { Alert.alert(t('common.permissionNeeded'), "Allow camera access"); return }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["videos"], allowsEditing: false, quality: 1, videoMaxDuration: 60 })
    if (result.canceled) return
    setUploadingVideo(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const uri = result.assets[0].uri
      const fileName = "swing_" + player.id + "_" + Date.now() + ".mp4"
      const response = await fetch(uri)
      const blob = await response.blob()
      const { error } = await supabase.storage.from("swing-videos").upload(fileName, blob, { contentType: "video/mp4" })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from("swing-videos").getPublicUrl(fileName)
      await supabase.from("swing_videos").insert({ player_id: player.id, coach_id: user.id, video_url: publicUrl, title: "Swing " + new Date().toLocaleDateString("fr-FR") })
      Alert.alert(t('playerVideos.uploaded'))
      fetchAll()
    } catch(e) { Alert.alert(t('common.error'), e.message) }
    setUploadingVideo(false)
  }

  const revenue = sessions.reduce((sum, ss) => sum + (ss.price || 0), 0)
  const now = new Date()
  const last = sessions[0]
  const days = last ? Math.floor((now - new Date(last.session_date)) / (1000*60*60*24)) : null

  if (loading) return (
    <View style={s.loading}>
      <CardListSkeleton />
    </View>
  )

  const renderHcpChart = () => {
    if (hcpEntries.length < 2) return <Text style={s.empty}>Add at least 2 entries to see the chart</Text>
    const data = hcpEntries.slice(-8)
    const values = data.map(e => e.handicap)
    const maxV = Math.max(...values) + 0.5
    const minV = Math.min(...values) - 0.5
    const range = maxV - minV || 1
    const W = 300, H = 130, padL = 28, padR = 8, padT = 10, padB = 20
    const chartW = W - padL - padR
    const chartH = H - padT - padB
    const pts = data.map((e, i) => ({
      x: padL + (i / (data.length - 1)) * chartW,
      y: padT + ((maxV - e.handicap) / range) * chartH,
      val: e.handicap,
      date: e.date?.slice(5)
    }))
    const linePath = pts.map((p, i) => (i === 0 ? "M" : "L") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" ")
    const areaPath = linePath + " L" + pts[pts.length-1].x.toFixed(1) + " " + (padT + chartH) + " L" + pts[0].x.toFixed(1) + " " + (padT + chartH) + " Z"
    const first = data[0]?.handicap
    const lastVal = data[data.length-1]?.handicap
    const diff = (lastVal - first).toFixed(1)
    return (
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: "row", gap: 16, marginBottom: 10 }}>
          <Text style={{ fontSize: 12, color: colors.textTertiary }}>{t('playerDetail.start')}: <Text style={{ fontWeight: "700", color: colors.text }}>{first}</Text></Text>
          <Text style={{ fontSize: 12, color: colors.textTertiary }}>{t('playerDetail.current')}: <Text style={{ fontWeight: "700", color: colors.text }}>{lastVal}</Text></Text>
          <Text style={{ fontSize: 12, fontWeight: "700", color: diff <= 0 ? colors.primary : colors.destructive }}>{diff > 0 ? "+" : ""}{diff} {t('playerDetail.pts')}</Text>
        </View>
        <Svg width={W} height={H}>
          <Defs>
            <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.primary} stopOpacity="0.2" />
              <Stop offset="1" stopColor={colors.primary} stopOpacity="0.02" />
            </LinearGradient>
          </Defs>
          <Line x1={padL} y1={padT} x2={padL} y2={padT + chartH} stroke={colors.separator} strokeWidth="1" />
          <Line x1={padL} y1={padT + chartH} x2={W - padR} y2={padT + chartH} stroke={colors.separator} strokeWidth="1" />
          <SvgText x={padL - 4} y={padT + 4} fontSize="9" fill={colors.textTertiary} textAnchor="end">{maxV.toFixed(1)}</SvgText>
          <SvgText x={padL - 4} y={padT + chartH + 2} fontSize="9" fill={colors.textTertiary} textAnchor="end">{minV.toFixed(1)}</SvgText>
          <Path d={areaPath} fill="url(#grad)" />
          <Path d={linePath} stroke={colors.primary} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          {pts.map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 5 : 3} fill={i === pts.length - 1 ? colors.primary : "#86EFAC"} stroke={colors.card} strokeWidth="1.5" />
          ))}
          <SvgText x={pts[0]?.x} y={H} fontSize="9" fill={colors.textTertiary} textAnchor="start">{pts[0]?.date}</SvgText>
          <SvgText x={pts[pts.length-1]?.x} y={H} fontSize="9" fill={colors.textTertiary} textAnchor="end">{pts[pts.length-1]?.date}</SvgText>
        </Svg>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {data.map((e, i) => (
            <View key={i} style={{ backgroundColor: colors.inputBg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 0.5, borderColor: colors.separator }}>
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>{e.date} — <Text style={{ fontWeight: "700", color: colors.primary }}>{e.handicap}</Text></Text>
            </View>
          ))}
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
          <Text style={s.backTxt}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{player.full_name}</Text>
        <AnimatedPressable onPress={invitePlayer} style={s.inviteBtn}>
          <Ionicons name="link-outline" size={16} color={colors.primary} />
          <Text style={s.inviteBtnTxt}> {t('playerDetail.invite')}</Text>
        </AnimatedPressable>
      </View>
      <ScrollView style={s.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll() }} tintColor={colors.primary} />}>

        {/* Quick action bar */}
        <View style={s.quickActions}>
          <AnimatedPressable style={s.chatBtn} onPress={() => navigation.navigate('Space', { player })}>
            <Ionicons name="chatbubble-outline" size={18} color="#fff" />
            <Text style={s.chatBtnTxt}> {t('playerDetail.chatTimeline')}</Text>
          </AnimatedPressable>
          <AnimatedPressable style={s.actionBtnSmall} onPress={uploadVideo}>
            <Ionicons name="videocam-outline" size={22} color={colors.text} />
          </AnimatedPressable>
          <AnimatedPressable style={s.actionBtnSmall} onPress={() => {
            if (sessions[0]) generateAIPlan(sessions[0])
          }}>
            <Text style={s.actionBtnSmallTxt}>✦</Text>
          </AnimatedPressable>
        </View>

        <View style={s.statsRow}>
          {[
            { label: t('playerDetail.handicapLabel'), value: player.current_handicap },
            { label: t('playerDetail.revenueLabel'), value: revenue + "\u20AC" },
            { label: t('playerDetail.sessionsLabel'), value: sessions.length },
            { label: t('playerDetail.lastLabel'), value: days !== null ? t('playerDetail.daysAgo', { days }) : t('playerDetail.never') },
          ].map((stat, i) => (
            <AnimatedListItem key={i} index={i}>
              <View style={s.stat}>
                <Text style={s.statLabel}>{stat.label}</Text>
                <Text style={s.statValue}>{stat.value}</Text>
              </View>
            </AnimatedListItem>
          ))}
        </View>

        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>{t('playerDetail.handicapEvolution')}</Text>
            <AnimatedPressable onPress={() => setShowHcpInput(!showHcpInput)} style={s.aiBtn}>
              <Text style={s.aiBtnTxt}>{t('playerDetail.addHcp')}</Text>
            </AnimatedPressable>
          </View>
          {showHcpInput && (
            <View style={{ padding: 14, borderBottomWidth: 0.5, borderBottomColor: colors.separatorLight, gap: 10 }}>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TextInput style={[s.hcpInput, { flex: 1 }]} value={newHcp} onChangeText={setNewHcp} placeholder={t('playerDetail.hcpPlaceholder')} keyboardType="decimal-pad" placeholderTextColor={colors.textTertiary} />
                <TouchableOpacity onPress={() => setShowDatePicker(true)} style={[s.hcpInput, { flex: 1.5, justifyContent: "center" }]}>
                  <Text style={{ color: colors.text, fontSize: 15 }}>{newHcpDate}</Text>
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={new Date(newHcpDate)}
                    mode="date"
                    display="spinner"
                    onChange={(event, date) => {
                      setShowDatePicker(false)
                      if (date) setNewHcpDate(date.toISOString().split("T")[0])
                    }}
                  />
                )}
              </View>
              <AnimatedPressable onPress={addHcpEntry} style={[s.aiBtn, { alignItems: "center" }]}>
                <Text style={s.aiBtnTxt}>{t('common.save')}</Text>
              </AnimatedPressable>
            </View>
          )}
          {renderHcpChart()}
        </View>

        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>{t('playerDetail.sessionHistory')}</Text>
            <Text style={s.sectionSub}>{sessions.length} {t('common.sessions')}</Text>
          </View>
          {sessions.length === 0 ? (
            <Text style={s.empty}>{t('playerDetail.noSessions')}</Text>
          ) : sessions.map((session, idx) => (
            <AnimatedListItem key={session.id} index={idx}>
              <View style={s.sessionRow}>
                <View style={s.sessionInfo}>
                  <Text style={s.sessionDate}>{session.session_date}</Text>
                  {session.notes ? <Text style={s.sessionNotes}>{session.notes}</Text> : null}
                </View>
                <Text style={s.sessionPrice}>{session.price}\u20AC</Text>
                <AnimatedPressable onPress={() => generateAIPlan(session)} disabled={generating === session.id} style={[s.aiBtn, generating === session.id && s.aiBtnLoading]}>
                  <Text style={[s.aiBtnTxt, generating === session.id && { color: colors.primary }]}>{generating === session.id ? "..." : "\u2726 AI Plan"}</Text>
                </AnimatedPressable>
              </View>
            </AnimatedListItem>
          ))}
        </View>

        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>{t('playerDetail.swingVideos')}</Text>
            <AnimatedPressable onPress={uploadVideo} disabled={uploadingVideo} style={[s.aiBtn, uploadingVideo && { backgroundColor: colors.primaryLight }]}>
              <Text style={[s.aiBtnTxt, uploadingVideo && { color: colors.primary }]}>{uploadingVideo ? "..." : "+ " + t('playerDetail.film')}</Text>
            </AnimatedPressable>
          </View>
          {videos.length === 0 ? (
            <Text style={s.empty}>{t('playerDetail.noVideos')}</Text>
          ) : videos.map((v, idx) => (
            <AnimatedListItem key={v.id} index={idx}>
              <View style={s.sessionRow}>
                <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginRight: 8 }}>
                  <Ionicons name="videocam-outline" size={20} color={colors.primary} />
                </View>
                <View style={s.sessionInfo}>
                  <Text style={s.sessionDate}>{v.title || t('playerDetail.swingVideo')}</Text>
                  <Text style={{ fontSize: 11, color: colors.textTertiary }}>{new Date(v.created_at).toLocaleDateString("fr-FR")}</Text>
                </View>
              </View>
            </AnimatedListItem>
          ))}
        </View>

        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>{t('playerDetail.exercises')}</Text>
            <Text style={s.sectionSub}>{exercises.filter(e => e.completed).length}/{exercises.length} {t('playerDetail.done')}</Text>
          </View>
          {exercises.length === 0 ? (
            <Text style={s.empty}>{t('playerDetail.noExercises')}</Text>
          ) : exercises.map((ex, idx) => (
            <AnimatedListItem key={ex.id} index={idx}>
              <TouchableOpacity style={s.exRow} onPress={async () => { await supabase.from("exercises").update({ completed: !ex.completed }).eq("id", ex.id); fetchAll() }}>
                <View style={[s.exDot, ex.completed && s.exDotDone]} />
                <View style={s.exInfo}>
                  <Text style={[s.exTitle, ex.completed && s.exTitleDone]}>{ex.title}</Text>
                  {ex.description ? <Text style={s.exDesc}>{ex.description}</Text> : null}
                </View>
              </TouchableOpacity>
            </AnimatedListItem>
          ))}
        </View>

        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>{t('playerDetail.rounds')}</Text>
            <Text style={s.sectionSub}>{t('playerDetail.roundCount', { count: rounds.length })}</Text>
          </View>
          {rounds.length === 0 ? (
            <Text style={s.empty}>{t('playerDetail.noRounds')}</Text>
          ) : rounds.map((r, idx) => (
            <AnimatedListItem key={r.id} index={idx}>
              <View style={s.sessionRow}>
                <View style={s.sessionInfo}>
                  <Text style={s.sessionDate}>{r.course_name || t('playerDetail.golfCourse')}</Text>
                  <Text style={{ fontSize: 11, color: colors.textTertiary }}>{r.played_at}</Text>
                </View>
                <View style={{ alignItems: "center", marginRight: 8 }}>
                  <Text style={{ fontSize: 22, fontWeight: "800", color: colors.primary }}>{r.score}</Text>
                  <Text style={{ fontSize: 9, color: colors.textTertiary }}>Score</Text>
                </View>
              </View>
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
  loading: { flex: 1, backgroundColor: c.bgSecondary },
  quickActions: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  chatBtn: { flex: 1, backgroundColor: c.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  chatBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '600' },
  actionBtnSmall: { width: 50, height: 50, borderRadius: 14, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center', ...c.shadow },
  actionBtnSmallTxt: { fontSize: 22 },
  header: { backgroundColor: c.card, flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: 0.5, borderBottomColor: c.separator },
  backBtn: { paddingRight: 8, flexDirection: 'row', alignItems: 'center' },
  backTxt: { fontSize: 16, color: c.primary, fontWeight: "600" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: c.text, flex: 1 },
  inviteBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.primaryLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  inviteBtnTxt: { fontSize: 13, fontWeight: '600', color: c.primary },
  scroll: { flex: 1 },
  statsRow: { flexDirection: "row", gap: 8, padding: 16 },
  stat: { flex: 1, backgroundColor: c.card, borderRadius: 12, padding: 12, alignItems: "center", ...c.shadow },
  statLabel: { fontSize: 8, color: c.textTertiary, fontWeight: "600", letterSpacing: 0.1, marginBottom: 6 },
  statValue: { fontSize: 18, fontWeight: "800", color: c.primary, letterSpacing: -0.5 },
  section: { backgroundColor: c.card, borderRadius: 16, margin: 16, marginTop: 0, overflow: "hidden", ...c.shadow },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 0.5, borderBottomColor: c.separatorLight },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: c.text },
  sectionSub: { fontSize: 12, color: c.textTertiary },
  empty: { padding: 24, textAlign: "center", color: c.textTertiary, fontSize: 13 },
  sessionRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 14, borderBottomWidth: 0.5, borderBottomColor: c.separatorLight },
  sessionInfo: { flex: 1 },
  sessionDate: { fontSize: 13, fontWeight: "500", color: c.text },
  sessionNotes: { fontSize: 11, color: c.textTertiary, marginTop: 2 },
  sessionPrice: { fontSize: 14, fontWeight: "700", color: c.primary },
  aiBtn: { backgroundColor: c.primary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  aiBtnLoading: { backgroundColor: c.primaryLight },
  aiBtnTxt: { color: "#fff", fontSize: 11, fontWeight: "700" },
  exRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14, borderBottomWidth: 0.5, borderBottomColor: c.separatorLight },
  exDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: c.separator, marginTop: 2 },
  exDotDone: { backgroundColor: c.primary, borderColor: c.primary },
  exInfo: { flex: 1 },
  exTitle: { fontSize: 13, fontWeight: "600", color: c.text },
  exTitleDone: { color: c.textTertiary, textDecorationLine: "line-through" },
  exDesc: { fontSize: 11, color: c.textTertiary, marginTop: 2, lineHeight: 16 },
  hcpInput: { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10, padding: 10, fontSize: 15, color: c.text },
})
