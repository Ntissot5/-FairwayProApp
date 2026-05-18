import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, TextInput, Alert, Share } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import DateTimePicker from '@react-native-community/datetimepicker'
import { Ionicons } from '@expo/vector-icons'
import { Svg, Path, Circle, Text as SvgText, Line, Defs, LinearGradient, Stop } from 'react-native-svg'
import * as FileSystem from 'expo-file-system/legacy'
import { decode } from 'base64-arraybuffer'
import { supabase } from './supabase'
import { colors } from './theme'
import { formatDate, formatCurrency } from './lib/format'
import RelanceModal from './components/RelanceModal'

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
  const [editingHcp, setEditingHcp] = useState(null)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [showRelance, setShowRelance] = useState(false)
  const [coachId, setCoachId] = useState(null)

  useEffect(() => {
    fetchAll()
    supabase.auth.getUser().then(({ data: { user } }) => setCoachId(user?.id))
  }, [])

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
    const value = parseFloat(newHcp)
    if (editingHcp) {
      await supabase.from("handicap_history").update({ handicap: value, date: newHcpDate }).eq("id", editingHcp.id)
    } else {
      await supabase.from("handicap_history").insert({ player_id: player.id, handicap: value, date: newHcpDate })
    }
    // Refresh current_handicap from the latest entry by date
    const { data: latest } = await supabase.from("handicap_history").select("handicap").eq("player_id", player.id).order("date", { ascending: false }).limit(1).single()
    if (latest?.handicap !== undefined && latest?.handicap !== null) {
      await supabase.from("players").update({ current_handicap: latest.handicap }).eq("id", player.id)
      setPlayer({ ...player, current_handicap: latest.handicap })
    }
    setNewHcp("")
    setShowHcpInput(false)
    setEditingHcp(null)
    fetchAll()
  }

  const deleteHcpEntry = async (entry) => {
    Alert.alert(
      "Supprimer cette entrée ?",
      formatDate(entry.date) + " · HCP " + entry.handicap,
      [
        { text: "Annuler", style: "cancel" },
        { text: "Supprimer", style: "destructive", onPress: async () => {
          await supabase.from("handicap_history").delete().eq("id", entry.id)
          fetchAll()
        }},
      ]
    )
  }

  const startEditHcp = (entry) => {
    setEditingHcp(entry)
    setNewHcp(String(entry.handicap))
    setNewHcpDate(entry.date)
    setShowHcpInput(true)
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
      const exercises = JSON.parse(clean)
      for (const ex of exercises) {
        await supabase.from('exercises').insert({ player_id: player.id, coach_id: user.id, title: ex.title, description: ex.description, completed: false })
      }
      // Mark first AI plan timestamp for onboarding (idempotent)
      if (!user.user_metadata?.first_ai_plan_at) {
        try { await supabase.auth.updateUser({ data: { first_ai_plan_at: new Date().toISOString() } }) } catch {}
      }
      Alert.alert('✓ Plan généré !', '3 exercices ajoutés pour ' + player.full_name)
    fetchAll()
    } catch(e) { Alert.alert('Erreur', e.message) }
    setGenerating(null)
  }

  const uploadVideo = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== "granted") { Alert.alert("Permission requise", "Autorise l'accès à la caméra"); return }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["videos"], allowsEditing: false, quality: 1, videoMaxDuration: 60 })
    if (result.canceled) return
    setUploadingVideo(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const uri = result.assets[0].uri
      const fileName = "swing_" + player.id + "_" + Date.now() + ".mp4"
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' })
      const arrayBuffer = decode(base64)
      const { error } = await supabase.storage.from("swing-videos").upload(fileName, arrayBuffer, { contentType: "video/mp4", upsert: false })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from("swing-videos").getPublicUrl(fileName)
      await supabase.from("swing_videos").insert({ player_id: player.id, coach_id: user.id, video_url: publicUrl, title: "Swing " + formatDate(new Date()) })
      Alert.alert("Vidéo enregistrée !")
      fetchAll()
    } catch(e) { Alert.alert("Erreur", e.message) }
    setUploadingVideo(false)
  }

  const revenue = sessions.reduce((sum, s) => sum + (s.price || 0), 0)
  const now = new Date()
  const last = sessions[0]
  const days = last ? Math.floor((now - new Date(last.session_date)) / (1000*60*60*24)) : null

  if (loading) return <View style={s.loading}><ActivityIndicator color={colors.primary} size="large" /></View>

  const renderHcpChart = () => {
    if (hcpEntries.length < 2) return null
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
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>Début: <Text style={{ fontWeight: "700", color: colors.textPrimary }}>{first}</Text></Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>Actuel: <Text style={{ fontWeight: "700", color: colors.textPrimary }}>{lastVal}</Text></Text>
          <Text style={{ fontSize: 12, fontWeight: "700", color: diff <= 0 ? colors.primary : colors.error }}>{diff > 0 ? "+" : ""}{diff} pts</Text>
        </View>
        <Svg width={W} height={H}>
          <Defs>
            <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.primary} stopOpacity="0.2" />
              <Stop offset="1" stopColor={colors.primary} stopOpacity="0.02" />
            </LinearGradient>
          </Defs>
          <Line x1={padL} y1={padT} x2={padL} y2={padT + chartH} stroke={colors.borderStrong} strokeWidth="1" />
          <Line x1={padL} y1={padT + chartH} x2={W - padR} y2={padT + chartH} stroke={colors.borderStrong} strokeWidth="1" />
          <SvgText x={padL - 4} y={padT + 4} fontSize="9" fill={colors.textTertiary} textAnchor="end">{maxV.toFixed(1)}</SvgText>
          <SvgText x={padL - 4} y={padT + chartH + 2} fontSize="9" fill={colors.textTertiary} textAnchor="end">{minV.toFixed(1)}</SvgText>
          <Path d={areaPath} fill="url(#grad)" />
          <Path d={linePath} stroke={colors.primary} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          {pts.map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 5 : 3} fill={i === pts.length - 1 ? colors.primary : "#86EFAC"} stroke="white" strokeWidth="1.5" />
          ))}
          <SvgText x={pts[0]?.x} y={H} fontSize="9" fill={colors.textTertiary} textAnchor="start">{pts[0]?.date}</SvgText>
          <SvgText x={pts[pts.length-1]?.x} y={H} fontSize="9" fill={colors.textTertiary} textAnchor="end">{pts[pts.length-1]?.date}</SvgText>
        </Svg>
      </View>
    )
  }

  const renderHcpEntries = () => {
    if (hcpEntries.length === 0) return null
    const sorted = [...hcpEntries].sort((a, b) => new Date(b.date) - new Date(a.date))
    return (
      <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textTertiary, letterSpacing: 0.2, marginBottom: 8, marginTop: 4 }}>HISTORIQUE</Text>
        {sorted.map(entry => (
          <View key={entry.id} style={s.hcpEntryRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.hcpEntryDate}>{formatDate(entry.date)}</Text>
              <Text style={s.hcpEntryValue}>HCP <Text style={{ fontWeight: '800', color: colors.primary }}>{entry.handicap}</Text></Text>
            </View>
            <TouchableOpacity onPress={() => startEditHcp(entry)} style={s.hcpActionBtn}>
              <Ionicons name="pencil" size={13} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteHcpEntry(entry)} style={[s.hcpActionBtn, { marginLeft: 6 }]}>
              <Ionicons name="trash-outline" size={13} color={colors.error} />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    )
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backTxt}>‹ Retour</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{player.full_name}</Text>
        <TouchableOpacity onPress={() => setShowRelance(true)} style={s.relanceBtn}>
          <Ionicons name="chatbubble-outline" size={14} color={colors.primary} />
          <Text style={s.relanceBtnTxt}>Relancer</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={invitePlayer} style={s.inviteBtn}>
          <Text style={s.inviteBtnTxt}>Inviter</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={s.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll() }} tintColor={colors.primary} />}>

        <View style={s.statsRow}>
          {[
            { label: "HANDICAP", value: player.current_handicap },
            { label: "REVENU", value: formatCurrency(revenue) },
            { label: "SÉANCES", value: sessions.length },
            { label: "DERNIÈRE", value: days !== null ? "J-" + days : "Jamais" },
          ].map((stat, i) => (
            <View key={i} style={s.stat}>
              <Text style={s.statLabel}>{stat.label}</Text>
              <Text style={s.statValue}>{stat.value}</Text>
            </View>
          ))}
        </View>

        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>Évolution du handicap</Text>
            <TouchableOpacity onPress={() => { if (showHcpInput) { setEditingHcp(null); setNewHcp(''); } setShowHcpInput(!showHcpInput) }} style={s.aiBtn}>
              <Text style={s.aiBtnTxt}>{showHcpInput ? 'Fermer' : '+ Ajouter'}</Text>
            </TouchableOpacity>
          </View>
          {showHcpInput && (
            <View style={{ padding: 14, borderBottomWidth: 0.5, borderBottomColor: colors.border, gap: 10 }}>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TextInput style={[s.hcpInput, { flex: 1 }]} value={newHcp} onChangeText={setNewHcp} placeholder="HCP (ex: 8.2)" keyboardType="decimal-pad" placeholderTextColor={colors.textTertiary} />
                <TouchableOpacity onPress={() => setShowDatePicker(true)} style={[s.hcpInput, { flex: 1.5, justifyContent: "center" }]}>
                  <Text style={{ color: colors.textPrimary, fontSize: 15 }}>{formatDate(newHcpDate)}</Text>
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
                <Text style={s.aiBtnTxt}>{editingHcp ? 'Enregistrer' : 'Ajouter'}</Text>
              </TouchableOpacity>
            </View>
          )}
          {hcpEntries.length < 2 && (
            <View style={{ paddingHorizontal: 16, paddingVertical: 20, alignItems: 'center' }}>
              <Ionicons name="trending-up" size={28} color={colors.textTertiary} />
              <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 18 }}>Entrez au moins 2 données pour voir le graphique d'évolution</Text>
            </View>
          )}
          {renderHcpChart()}
          {renderHcpEntries()}
        </View>

        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>Historique des séances</Text>
            <Text style={s.sectionSub}>{sessions.length} séance{sessions.length > 1 ? 's' : ''}</Text>
          </View>
          {sessions.length === 0 ? (
            <Text style={s.empty}>Aucune séance pour l'instant</Text>
          ) : sessions.map(session => (
            <View key={session.id} style={s.sessionRow}>
              <View style={s.sessionInfo}>
                <Text style={s.sessionDate}>{formatDate(session.session_date)}</Text>
                {session.notes ? <Text style={s.sessionNotes}>{session.notes}</Text> : null}
              </View>
              <Text style={s.sessionPrice}>{formatCurrency(session.price)}</Text>
              <TouchableOpacity onPress={() => generateAIPlan(session)} disabled={generating === session.id} style={[s.aiBtn, generating === session.id && s.aiBtnLoading]}>
                <Text style={[s.aiBtnTxt, generating === session.id && { color: colors.primary }]}>{generating === session.id ? "..." : "✦ Plan IA"}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>Vidéos de swing</Text>
            <TouchableOpacity onPress={uploadVideo} disabled={uploadingVideo} style={[s.aiBtn, uploadingVideo && { backgroundColor: colors.primaryLight }]}>
              <Text style={[s.aiBtnTxt, uploadingVideo && { color: colors.primary }]}>{uploadingVideo ? "..." : "+ Filmer"}</Text>
            </TouchableOpacity>
          </View>
          {videos.length === 0 ? (
            <Text style={s.empty}>Aucune vidéo pour l'instant</Text>
          ) : videos.map(v => (
            <View key={v.id} style={s.sessionRow}>
              <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginRight: 8 }}>
                <Ionicons name="videocam-outline" size={20} color={colors.primary} />
              </View>
              <View style={s.sessionInfo}>
                <Text style={s.sessionDate}>{v.title || "Vidéo de swing"}</Text>
                <Text style={{ fontSize: 11, color: colors.textTertiary }}>{formatDate(v.created_at)}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>Exercices assignés</Text>
            <Text style={s.sectionSub}>{exercises.filter(e => e.completed).length}/{exercises.length} faits</Text>
          </View>
          {exercises.length === 0 ? (
            <Text style={s.empty}>Aucun exercice assigné</Text>
          ) : exercises.map(ex => (
            <TouchableOpacity key={ex.id} style={s.exRow} onPress={async () => { await supabase.from("exercises").update({ completed: !ex.completed }).eq("id", ex.id); fetchAll() }}>
              <View style={[s.exDot, ex.completed && s.exDotDone]} />
              <View style={s.exInfo}>
                <Text style={[s.exTitle, ex.completed && s.exTitleDone]}>{ex.title}</Text>
                {ex.description ? <Text style={s.exDesc}>{ex.description}</Text> : null}
              </View>
            </TouchableOpacity>
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
                <Text style={s.sessionDate}>{r.course_name || "Parcours"}</Text>
                <Text style={{ fontSize: 11, color: colors.textTertiary }}>{formatDate(r.played_at)}</Text>
              </View>
              <View style={{ alignItems: "center", marginRight: 8 }}>
                <Text style={{ fontSize: 22, fontWeight: "800", color: colors.primary }}>{r.score}</Text>
                <Text style={{ fontSize: 9, color: colors.textTertiary }}>Score</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
      <RelanceModal visible={showRelance} player={player} coachId={coachId} sessions={sessions} onClose={() => setShowRelance(false)} />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surfaceElevated },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: 0.5, borderBottomColor: colors.borderStrong },
  backBtn: { paddingRight: 8 },
  backTxt: { fontSize: 16, color: colors.primary, fontWeight: "600" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: colors.textPrimary, flex: 1 },
  relanceBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primaryLight, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  relanceBtnTxt: { fontSize: 12, fontWeight: '600', color: colors.primary },
  scroll: { flex: 1 },
  statsRow: { flexDirection: "row", gap: 8, padding: 16 },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 0.5, borderColor: colors.borderStrong },
  statLabel: { fontSize: 8, color: colors.textTertiary, fontWeight: "600", letterSpacing: 0.1, marginBottom: 6 },
  statValue: { fontSize: 18, fontWeight: "800", color: colors.primary, letterSpacing: -0.5 },
  section: { backgroundColor: colors.surface, borderRadius: 16, margin: 16, marginTop: 0, borderWidth: 0.5, borderColor: colors.borderStrong, overflow: "hidden" },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
  sectionSub: { fontSize: 12, color: colors.textTertiary },
  empty: { padding: 24, textAlign: "center", color: colors.textTertiary, fontSize: 13 },
  sessionRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 14, borderBottomWidth: 0.5, borderBottomColor: colors.surfaceElevated },
  sessionInfo: { flex: 1 },
  sessionDate: { fontSize: 13, fontWeight: "500", color: colors.textPrimary },
  sessionNotes: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  sessionPrice: { fontSize: 14, fontWeight: "700", color: colors.primary },
  aiBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  aiBtnLoading: { backgroundColor: colors.primaryLight },
  aiBtnTxt: { color: colors.textInverse, fontSize: 11, fontWeight: "700" },
  exRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14, borderBottomWidth: 0.5, borderBottomColor: colors.surfaceElevated },
  exDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.borderStrong, marginTop: 2 },
  exDotDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  exInfo: { flex: 1 },
  exTitle: { fontSize: 13, fontWeight: "600", color: colors.textPrimary },
  exTitleDone: { color: colors.textTertiary, textDecorationLine: "line-through" },
  exDesc: { fontSize: 11, color: colors.textTertiary, marginTop: 2, lineHeight: 16 },
  hcpInput: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 10, padding: 10, fontSize: 15, color: colors.textPrimary },
  hcpEntryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: colors.surfaceElevated, marginTop: 6 },
  hcpEntryDate: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  hcpEntryValue: { fontSize: 13, color: colors.textPrimary, marginTop: 2 },
  hcpActionBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: colors.borderStrong },
})
