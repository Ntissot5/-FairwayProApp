import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, TextInput, Alert, Share } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import DateTimePicker from '@react-native-community/datetimepicker'
import { Svg, Path, Circle, Text as SvgText, Line, Defs, LinearGradient, Stop } from 'react-native-svg'
import { supabase } from './supabase'

const G = '#1B5E35'

export default function PlayerDetailScreen({ route, navigation }) {
  const { player: initialPlayer } = route.params
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
    const { data: s } = await supabase.from("sessions").select("*").eq("player_id", player.id).order("session_date", { ascending: false })
    const { data: e } = await supabase.from("exercises").select("*").eq("player_id", player.id).order("created_at", { ascending: false })
    const { data: h } = await supabase.from("handicap_history").select("*").eq("player_id", player.id).order("date", { ascending: true })
    const { data: r } = await supabase.from("rounds").select("*").eq("player_id", player.id).order("played_at", { ascending: false })
    const { data: v } = await supabase.from("swing_videos").select("*").eq("player_id", player.id).order("created_at", { ascending: false })
    setSessions(s || [])
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
      // Check if invite already exists
      const { data: existing } = await supabase.from('player_invites').select('token').eq('player_id', player.id).eq('used', false).single()
      let token = existing?.token
      if (!token) {
        const { data: invite } = await supabase.from('player_invites').insert({ coach_id: user.id, player_id: player.id }).select('token').single()
        token = invite?.token
      }
      const link = 'https://fairwaypro.io/join/' + token
      await Share.share({
        message: 'Salut ' + player.full_name + ' ! Ton coach t\'invite sur FairwayPro. Télécharge l\'app et utilise ce lien pour rejoindre ton espace : ' + link,
        title: 'Invitation FairwayPro'
      })
    } catch(e) { Alert.alert('Erreur', e.message) }
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
    const player = players.find(p => p.id === session.player_id)
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
      const exercises = JSON.parse(clean)
      for (const ex of exercises) {
        await supabase.from('exercises').insert({ player_id: player.id, coach_id: user.id, title: ex.title, description: ex.description, completed: false })
      }
      Alert.alert('✓ Plan généré!', '3 exercices ajoutés pour ' + player.full_name)
    } catch(e) { Alert.alert('Erreur', e.message) }
    setGenerating(null)
  }

  const uploadVideo = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== "granted") { Alert.alert("Permission needed", "Allow camera access"); return }
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
      Alert.alert("Video uploaded!")
      fetchAll()
    } catch(e) { Alert.alert("Error", e.message) }
    setUploadingVideo(false)
  }

  const revenue = sessions.reduce((sum, s) => sum + (s.price || 0), 0)
  const now = new Date()
  const last = sessions[0]
  const days = last ? Math.floor((now - new Date(last.session_date)) / (1000*60*60*24)) : null

  if (loading) return <View style={s.loading}><ActivityIndicator color={G} size="large" /></View>

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
          <Text style={{ fontSize: 12, color: "#6B7280" }}>Début: <Text style={{ fontWeight: "700", color: "#1a1a1a" }}>{first}</Text></Text>
          <Text style={{ fontSize: 12, color: "#6B7280" }}>Actuel: <Text style={{ fontWeight: "700", color: "#1a1a1a" }}>{lastVal}</Text></Text>
          <Text style={{ fontSize: 12, fontWeight: "700", color: diff <= 0 ? G : "#DC2626" }}>{diff > 0 ? "+" : ""}{diff} pts</Text>
        </View>
        <Svg width={W} height={H}>
          <Defs>
            <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={G} stopOpacity="0.2" />
              <Stop offset="1" stopColor={G} stopOpacity="0.02" />
            </LinearGradient>
          </Defs>
          <Line x1={padL} y1={padT} x2={padL} y2={padT + chartH} stroke="#E5E7EB" strokeWidth="1" />
          <Line x1={padL} y1={padT + chartH} x2={W - padR} y2={padT + chartH} stroke="#E5E7EB" strokeWidth="1" />
          <SvgText x={padL - 4} y={padT + 4} fontSize="9" fill="#9CA3AF" textAnchor="end">{maxV.toFixed(1)}</SvgText>
          <SvgText x={padL - 4} y={padT + chartH + 2} fontSize="9" fill="#9CA3AF" textAnchor="end">{minV.toFixed(1)}</SvgText>
          <Path d={areaPath} fill="url(#grad)" />
          <Path d={linePath} stroke={G} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          {pts.map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 5 : 3} fill={i === pts.length - 1 ? G : "#86EFAC"} stroke="white" strokeWidth="1.5" />
          ))}
          <SvgText x={pts[0]?.x} y={H} fontSize="9" fill="#9CA3AF" textAnchor="start">{pts[0]?.date}</SvgText>
          <SvgText x={pts[pts.length-1]?.x} y={H} fontSize="9" fill="#9CA3AF" textAnchor="end">{pts[pts.length-1]?.date}</SvgText>
        </Svg>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {data.map((e, i) => (
            <View key={i} style={{ backgroundColor: "#F8FAF8", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 0.5, borderColor: "#E5E7EB" }}>
              <Text style={{ fontSize: 11, color: "#374151" }}>{e.date} — <Text style={{ fontWeight: "700", color: G }}>{e.handicap}</Text></Text>
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
          <Text style={s.backTxt}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{player.full_name}</Text>
        <TouchableOpacity onPress={invitePlayer} style={s.inviteBtn}>
          <Text style={s.inviteBtnTxt}>🔗 Inviter</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={s.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll() }} tintColor={G} />}>

        <View style={s.statsRow}>
          {[
            { label: "HANDICAP", value: player.current_handicap },
            { label: "REVENUE", value: revenue + "€" },
            { label: "SESSIONS", value: sessions.length },
            { label: "LAST", value: days !== null ? "J-" + days : "Never" },
          ].map((stat, i) => (
            <View key={i} style={s.stat}>
              <Text style={s.statLabel}>{stat.label}</Text>
              <Text style={s.statValue}>{stat.value}</Text>
            </View>
          ))}
        </View>

        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>Handicap evolution</Text>
            <TouchableOpacity onPress={() => setShowHcpInput(!showHcpInput)} style={s.aiBtn}>
              <Text style={s.aiBtnTxt}>+ Add</Text>
            </TouchableOpacity>
          </View>
          {showHcpInput && (
            <View style={{ padding: 14, borderBottomWidth: 0.5, borderBottomColor: "#F0F4F0", gap: 10 }}>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TextInput style={[s.hcpInput, { flex: 1 }]} value={newHcp} onChangeText={setNewHcp} placeholder="HCP (ex: 8.2)" keyboardType="decimal-pad" placeholderTextColor="#9CA3AF" />
                <TouchableOpacity onPress={() => setShowDatePicker(true)} style={[s.hcpInput, { flex: 1.5, justifyContent: "center" }]}>
                  <Text style={{ color: "#1a1a1a", fontSize: 15 }}>{newHcpDate}</Text>
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
              <TouchableOpacity onPress={addHcpEntry} style={[s.aiBtn, { alignItems: "center" }]}>
                <Text style={s.aiBtnTxt}>Save</Text>
              </TouchableOpacity>
            </View>
          )}
          {renderHcpChart()}
        </View>

        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>Session history</Text>
            <Text style={s.sectionSub}>{sessions.length} sessions</Text>
          </View>
          {sessions.length === 0 ? (
            <Text style={s.empty}>No sessions yet</Text>
          ) : sessions.map(session => (
            <View key={session.id} style={s.sessionRow}>
              <View style={s.sessionInfo}>
                <Text style={s.sessionDate}>{session.session_date}</Text>
                {session.notes ? <Text style={s.sessionNotes}>{session.notes}</Text> : null}
              </View>
              <Text style={s.sessionPrice}>{session.price}€</Text>
              <TouchableOpacity onPress={() => generateAIPlan(session)} disabled={generating === session.id} style={[s.aiBtn, generating === session.id && s.aiBtnLoading]}>
                <Text style={[s.aiBtnTxt, generating === session.id && { color: G }]}>{generating === session.id ? "..." : "✦ AI Plan"}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>Swing Videos</Text>
            <TouchableOpacity onPress={uploadVideo} disabled={uploadingVideo} style={[s.aiBtn, uploadingVideo && { backgroundColor: "#E8F5EE" }]}>
              <Text style={[s.aiBtnTxt, uploadingVideo && { color: G }]}>{uploadingVideo ? "..." : "+ Film"}</Text>
            </TouchableOpacity>
          </View>
          {videos.length === 0 ? (
            <Text style={s.empty}>No videos yet</Text>
          ) : videos.map(v => (
            <View key={v.id} style={s.sessionRow}>
              <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: "#f0faf4", alignItems: "center", justifyContent: "center", marginRight: 8 }}>
                <Text style={{ fontSize: 20 }}>🎥</Text>
              </View>
              <View style={s.sessionInfo}>
                <Text style={s.sessionDate}>{v.title || "Swing video"}</Text>
                <Text style={{ fontSize: 11, color: "#9CA3AF" }}>{new Date(v.created_at).toLocaleDateString("fr-FR")}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>Assigned exercises</Text>
            <Text style={s.sectionSub}>{exercises.filter(e => e.completed).length}/{exercises.length} done</Text>
          </View>
          {exercises.length === 0 ? (
            <Text style={s.empty}>No exercises assigned</Text>
          ) : exercises.map(ex => (
            <TouchableOpacity key={ex.id} style={s.exRow} onPress={async () => { await supabase.from("exercises").update({ completed: !ex.completed }).eq("id", ex.id); fetchAll() }}>
              <View style={[s.exDot, ex.completed && s.exDotDone]} />
              <View style={s.exInfo}>
                <Text style={[s.exTitle, ex.completed && s.exTitleDone]}>{ex.title}</Text>
                {ex.description ? <Text style={s.exDesc}>{ex.description}</Text> : null}
              </View>
            </View>
          ))}
        </View>

        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>Rounds joués</Text>
            <Text style={s.sectionSub}>{rounds.length} parties</Text>
          </View>
          {rounds.length === 0 ? (
            <Text style={s.empty}>Aucune partie enregistrée</Text>
          ) : rounds.map(r => (
            <View key={r.id} style={s.sessionRow}>
              <View style={s.sessionInfo}>
                <Text style={s.sessionDate}>{r.course_name || "Golf course"}</Text>
                <Text style={{ fontSize: 11, color: "#9CA3AF" }}>{r.played_at}</Text>
              </View>
              <View style={{ alignItems: "center", marginRight: 8 }}>
                <Text style={{ fontSize: 22, fontWeight: "800", color: G }}>{r.score}</Text>
                <Text style={{ fontSize: 9, color: "#9CA3AF" }}>Score</Text>
              </View>
            </View>
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
  header: { backgroundColor: "#fff", flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB" },
  backBtn: { paddingRight: 8 },
  backTxt: { fontSize: 16, color: G, fontWeight: "600" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#1a1a1a" },
  scroll: { flex: 1 },
  statsRow: { flexDirection: "row", gap: 8, padding: 16 },
  stat: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 0.5, borderColor: "#E5E7EB" },
  statLabel: { fontSize: 8, color: "#9CA3AF", fontWeight: "600", letterSpacing: 0.1, marginBottom: 6 },
  statValue: { fontSize: 18, fontWeight: "800", color: G, letterSpacing: -0.5 },
  section: { backgroundColor: "#fff", borderRadius: 16, margin: 16, marginTop: 0, borderWidth: 0.5, borderColor: "#E5E7EB", overflow: "hidden" },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 0.5, borderBottomColor: "#F0F4F0" },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#1a1a1a" },
  sectionSub: { fontSize: 12, color: "#9CA3AF" },
  empty: { padding: 24, textAlign: "center", color: "#9CA3AF", fontSize: 13 },
  sessionRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 14, borderBottomWidth: 0.5, borderBottomColor: "#F8FAF8" },
  sessionInfo: { flex: 1 },
  sessionDate: { fontSize: 13, fontWeight: "500", color: "#1a1a1a" },
  sessionNotes: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  sessionPrice: { fontSize: 14, fontWeight: "700", color: G },
  aiBtn: { backgroundColor: G, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  aiBtnLoading: { backgroundColor: "#E8F5EE" },
  aiBtnTxt: { color: "#fff", fontSize: 11, fontWeight: "700" },
  exRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14, borderBottomWidth: 0.5, borderBottomColor: "#F8FAF8" },
  exDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "#E5E7EB", marginTop: 2 },
  exDotDone: { backgroundColor: G, borderColor: G },
  exInfo: { flex: 1 },
  exTitle: { fontSize: 13, fontWeight: "600", color: "#1a1a1a" },
  exTitleDone: { color: "#9CA3AF", textDecorationLine: "line-through" },
  exDesc: { fontSize: 11, color: "#9CA3AF", marginTop: 2, lineHeight: 16 },
  hcpInput: { backgroundColor: "#F8FAF8", borderWidth: 1, borderColor: "#E0E5E0", borderRadius: 10, padding: 10, fontSize: 15, color: "#1a1a1a" },
})
