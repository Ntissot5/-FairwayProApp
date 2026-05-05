import { useState, useEffect, useRef } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from './supabase'
import { Ionicons } from '@expo/vector-icons'

const G = '#1B5E35'
const colors = ['#1B5E35','#0891B2','#7C3AED','#DC2626','#D97706','#059669']

export default function PlayerCommunityScreen() {
  const [tab, setTab] = useState('golfers')
  const [players, setPlayers] = useState([])
  const [messages, setMessages] = useState([])
  const [gameRequests, setGameRequests] = useState([])
  const [myPlayer, setMyPlayer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [chatMessages, setChatMessages] = useState([])
  const [input, setInput] = useState('')
  const scrollRef = useRef(null)

  useEffect(() => { fetchAll() }, [])
  useEffect(() => { if (selectedPlayer) fetchChat() }, [selectedPlayer])

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: me } = await supabase.from('players').select('*').eq('player_user_id', user.id).single()
    setMyPlayer(me)
    const { data: all } = await supabase.from('players').select('*').eq('is_public', true).neq('player_user_id', user.id)
    const { data: gr } = await supabase.from('game_requests').select('*, players!game_requests_from_player_id_fkey(full_name)').eq('to_player_id', me?.id)
    setPlayers(all || [])
    setGameRequests(gr || [])
    setLoading(false)
  }

  const fetchChat = async () => {
    const { data } = await supabase.from('player_messages').select('*').or('sender_id.eq.' + myPlayer.id + ',receiver_id.eq.' + myPlayer.id).eq('receiver_id', selectedPlayer.id).order('created_at', { ascending: true })
    setChatMessages(data || [])
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
  }

  const sendMessage = async () => {
    if (!input.trim()) return
    await supabase.from('player_messages').insert({ sender_id: myPlayer.id, receiver_id: selectedPlayer.id, content: input.trim() })
    setInput('')
    fetchChat()
  }

  const requestGame = async (toPlayer) => {
    const date = new Date()
    date.setDate(date.getDate() + 7)
    await supabase.from('game_requests').insert({ from_player_id: myPlayer.id, to_player_id: toPlayer.id, course_name: 'À définir', game_date: date.toISOString().split('T')[0], status: 'pending' })
    Alert.alert('✓ Invitation envoyée à ' + toPlayer.full_name + '!')
  }

  if (selectedPlayer) return (
    <SafeAreaView style={s.safe}>
      <View style={s.chatHeader}>
        <TouchableOpacity onPress={() => setSelectedPlayer(null)}><Text style={s.backTxt}>‹ Back</Text></TouchableOpacity>
        <Text style={s.chatTitle}>{selectedPlayer.full_name}</Text>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={90}>
        <ScrollView ref={scrollRef} style={{ flex: 1, backgroundColor: '#f8f8f8' }} contentContainerStyle={{ padding: 16 }}>
          {chatMessages.map(m => (
            <View key={m.id} style={{ alignItems: m.sender_id === myPlayer?.id ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
              <View style={[s.bubble, m.sender_id === myPlayer?.id ? s.bubbleMe : s.bubbleThem]}>
                <Text style={[s.bubbleTxt, m.sender_id === myPlayer?.id && { color: '#fff' }]}>{m.content}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
        <View style={s.inputRow}>
          <TextInput style={s.inputMsg} value={input} onChangeText={setInput} placeholder="Message..." placeholderTextColor="#9CA3AF" />
          <TouchableOpacity style={s.sendBtn} onPress={sendMessage}><Text style={{ color: '#fff', fontSize: 16 }}>↑</Text></TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )

  if (loading) return <View style={s.loading}><ActivityIndicator color={G} size="large" /></View>

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Community</Text>
        <Text style={s.sub}>Tous les golfers FairwayPro</Text>
      </View>
      <View style={s.tabs}>
        {['golfers','messages','parties'].map(t => (
          <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView style={s.scroll}>
        {tab === 'golfers' && (
          <>
            <Text style={s.countLabel}>{players.length} GOLFERS SUR FAIRWAYPRO</Text>
            {players.map((p, i) => (
              <View key={p.id} style={s.playerCard}>
                <View style={[s.av, { backgroundColor: colors[i % colors.length] }]}>
                  <Text style={s.avTxt}>{p.full_name?.slice(0,2).toUpperCase()}</Text>
                </View>
                <View style={s.playerInfo}>
                  <Text style={s.playerName}>{p.full_name}</Text>
                </View>
                <Text style={s.hcp}>{p.current_handicap || 0}</Text>
                <Text style={s.hcpLabel}>HCP</Text>
                <TouchableOpacity style={s.msgBtn} onPress={() => setSelectedPlayer(p)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name="chatbubble-outline" size={12} color="#fff" /><Text style={s.msgBtnTxt}>Message</Text></View>
                </TouchableOpacity>
                <TouchableOpacity style={s.gameBtn} onPress={() => requestGame(p)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name="flag-outline" size={12} color={G} /><Text style={s.gameBtnTxt}>Partie</Text></View>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}
        {tab === 'messages' && (
          <>
            {players.length === 0 ? <Text style={s.empty}>No messages yet</Text> : players.map((p, i) => (
              <TouchableOpacity key={p.id} style={s.msgRow} onPress={() => setSelectedPlayer(p)}>
                <View style={[s.av, { backgroundColor: colors[i % colors.length] }]}>
                  <Text style={s.avTxt}>{p.full_name?.slice(0,2).toUpperCase()}</Text>
                </View>
                <View style={s.playerInfo}>
                  <Text style={s.playerName}>{p.full_name}</Text>
                  <Text style={s.msgPreview}>Tap to message</Text>
                </View>
                <Text style={s.arrow}>›</Text>
              </TouchableOpacity>
            ))}
          </>
        )}
        {tab === 'parties' && (
          <>
            {gameRequests.length === 0 ? <Text style={s.empty}>No game requests</Text> : gameRequests.map(gr => (
              <View key={gr.id} style={s.gameRequestCard}>
                <Text style={s.gameRequestFrom}>{gr.players?.full_name} vous invite</Text>
                <Text style={s.gameRequestCourse}>{gr.course_name} · {gr.game_date}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <TouchableOpacity style={[s.gameBtn, { flex: 1, alignItems: 'center' }]}
                    onPress={async () => { await supabase.from('game_requests').update({ status: 'accepted' }).eq('id', gr.id); fetchAll() }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name="checkmark" size={14} color={G} /><Text style={s.gameBtnTxt}>Accepter</Text></View>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.msgBtn, { flex: 1, alignItems: 'center' }]}
                    onPress={async () => { await supabase.from('game_requests').update({ status: 'declined' }).eq('id', gr.id); fetchAll() }}>
                    <Text style={s.msgBtnTxt}>✗ Refuser</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}
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
  tabs: { flexDirection: "row", backgroundColor: "#fff", padding: 4, margin: 16, marginBottom: 8, borderRadius: 12, borderWidth: 0.5, borderColor: "#E5E7EB" },
  tab: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10 },
  tabActive: { backgroundColor: G },
  tabTxt: { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  tabTxtActive: { color: "#fff" },
  scroll: { flex: 1 },
  countLabel: { fontSize: 11, fontWeight: "700", color: "#9CA3AF", paddingHorizontal: 16, marginBottom: 8, letterSpacing: 0.5 },
  playerCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", padding: 14, borderBottomWidth: 0.5, borderBottomColor: "#F0F4F0", gap: 8 },
  av: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avTxt: { color: "#fff", fontSize: 13, fontWeight: "700" },
  playerInfo: { flex: 1 },
  playerName: { fontSize: 14, fontWeight: "600", color: "#1a1a1a" },
  hcp: { fontSize: 16, fontWeight: "800", color: G },
  hcpLabel: { fontSize: 9, color: "#9CA3AF" },
  msgBtn: { backgroundColor: "#F8FAF8", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 0.5, borderColor: "#E5E7EB" },
  msgBtnTxt: { fontSize: 11, fontWeight: "600", color: "#374151" },
  gameBtn: { backgroundColor: G, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  gameBtnTxt: { fontSize: 11, fontWeight: "600", color: "#fff" },
  msgRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", padding: 16, borderBottomWidth: 0.5, borderBottomColor: "#F0F4F0", gap: 12 },
  msgPreview: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  arrow: { fontSize: 20, color: "#9CA3AF" },
  empty: { textAlign: "center", color: "#9CA3AF", padding: 40 },
  gameRequestCard: { backgroundColor: "#fff", margin: 16, marginBottom: 8, borderRadius: 14, padding: 16, borderWidth: 0.5, borderColor: "#E5E7EB" },
  gameRequestFrom: { fontSize: 15, fontWeight: "700", color: "#1a1a1a" },
  gameRequestCourse: { fontSize: 13, color: "#6B7280", marginTop: 4 },
  chatHeader: { backgroundColor: "#fff", flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB" },
  backTxt: { fontSize: 16, color: G, fontWeight: "600" },
  chatTitle: { fontSize: 16, fontWeight: "700", color: "#1a1a1a" },
  bubble: { maxWidth: "78%", padding: 12, borderRadius: 18 },
  bubbleMe: { backgroundColor: G, borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: "#fff", borderBottomLeftRadius: 4, borderWidth: 0.5, borderColor: "#E5E7EB" },
  bubbleTxt: { fontSize: 14, color: "#1a1a1a", lineHeight: 20 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, backgroundColor: "#fff", borderTopWidth: 0.5, borderTopColor: "#E5E7EB" },
  inputMsg: { flex: 1, backgroundColor: "#f2f2f7", borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: "#1a1a1a" },
  sendBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: G, alignItems: "center", justifyContent: "center" },
})
