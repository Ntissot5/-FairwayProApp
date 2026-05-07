import { useState, useEffect, useRef } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from './supabase'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { colors } from './theme'

const avatarColors = [colors.primary,'#0891B2','#7C3AED',colors.error,colors.warning,'#059669']

export default function PlayerCommunityScreen() {
  const { t } = useTranslation()
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
    Alert.alert(t('player_community.invitation_sent', { name: toPlayer.full_name }))
  }

  if (selectedPlayer) return (
    <SafeAreaView style={s.safe}>
      <View style={s.chatHeader}>
        <TouchableOpacity onPress={() => setSelectedPlayer(null)}><Text style={s.backTxt}>‹ Back</Text></TouchableOpacity>
        <Text style={s.chatTitle}>{selectedPlayer.full_name}</Text>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={90}>
        <ScrollView ref={scrollRef} style={{ flex: 1, backgroundColor: colors.surfaceElevated }} contentContainerStyle={{ padding: 16 }}>
          {chatMessages.map(m => (
            <View key={m.id} style={{ alignItems: m.sender_id === myPlayer?.id ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
              <View style={[s.bubble, m.sender_id === myPlayer?.id ? s.bubbleMe : s.bubbleThem]}>
                <Text style={[s.bubbleTxt, m.sender_id === myPlayer?.id && { color: colors.textInverse }]}>{m.content}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
        <View style={s.inputRow}>
          <TextInput style={s.inputMsg} value={input} onChangeText={setInput} placeholder="Message..." placeholderTextColor={colors.textTertiary} />
          <TouchableOpacity style={s.sendBtn} onPress={sendMessage}><Text style={{ color: colors.textInverse, fontSize: 16 }}>↑</Text></TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )

  if (loading) return <View style={s.loading}><ActivityIndicator color={colors.primary} size="large" /></View>

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>{t('player_community.title')}</Text>
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
                <View style={[s.av, { backgroundColor: avatarColors[i % avatarColors.length] }]}>
                  <Text style={s.avTxt}>{p.full_name?.slice(0,2).toUpperCase()}</Text>
                </View>
                <View style={s.playerInfo}>
                  <Text style={s.playerName}>{p.full_name}</Text>
                </View>
                <Text style={s.hcp}>{p.current_handicap || 0}</Text>
                <Text style={s.hcpLabel}>HCP</Text>
                <TouchableOpacity style={s.msgBtn} onPress={() => setSelectedPlayer(p)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name="chatbubble-outline" size={12} color="#fff" /><Text style={s.msgBtnTxt}>{t('player_community.message')}</Text></View>
                </TouchableOpacity>
                <TouchableOpacity style={s.gameBtn} onPress={() => requestGame(p)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name="flag-outline" size={12} color={colors.primary} /><Text style={s.gameBtnTxt}>{t('player_community.game')}</Text></View>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}
        {tab === 'messages' && (
          <>
            {players.length === 0 ? <Text style={s.empty}>No messages yet</Text> : players.map((p, i) => (
              <TouchableOpacity key={p.id} style={s.msgRow} onPress={() => setSelectedPlayer(p)}>
                <View style={[s.av, { backgroundColor: avatarColors[i % avatarColors.length] }]}>
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
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name="checkmark" size={14} color={colors.primary} /><Text style={s.gameBtnTxt}>{t('player_community.accept')}</Text></View>
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
  safe: { flex: 1, backgroundColor: colors.surfaceElevated },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { backgroundColor: colors.surface, padding: 16, paddingTop: 10, borderBottomWidth: 0.5, borderBottomColor: colors.borderStrong },
  title: { fontSize: 22, fontWeight: "800", color: colors.textPrimary },
  sub: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  tabs: { flexDirection: "row", backgroundColor: colors.surface, padding: 4, margin: 16, marginBottom: 8, borderRadius: 12, borderWidth: 0.5, borderColor: colors.borderStrong },
  tab: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10 },
  tabActive: { backgroundColor: colors.primary },
  tabTxt: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  tabTxtActive: { color: colors.textInverse },
  scroll: { flex: 1 },
  countLabel: { fontSize: 11, fontWeight: "700", color: colors.textTertiary, paddingHorizontal: 16, marginBottom: 8, letterSpacing: 0.5 },
  playerCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, padding: 14, borderBottomWidth: 0.5, borderBottomColor: colors.border, gap: 8 },
  av: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avTxt: { color: colors.textInverse, fontSize: 13, fontWeight: "700" },
  playerInfo: { flex: 1 },
  playerName: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },
  hcp: { fontSize: 16, fontWeight: "800", color: colors.primary },
  hcpLabel: { fontSize: 9, color: colors.textTertiary },
  msgBtn: { backgroundColor: colors.surfaceElevated, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 0.5, borderColor: colors.borderStrong },
  msgBtnTxt: { fontSize: 11, fontWeight: "600", color: colors.textSecondary },
  gameBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  gameBtnTxt: { fontSize: 11, fontWeight: "600", color: colors.textInverse },
  msgRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, padding: 16, borderBottomWidth: 0.5, borderBottomColor: colors.border, gap: 12 },
  msgPreview: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  arrow: { fontSize: 20, color: colors.textTertiary },
  empty: { textAlign: "center", color: colors.textTertiary, padding: 40 },
  gameRequestCard: { backgroundColor: colors.surface, margin: 16, marginBottom: 8, borderRadius: 14, padding: 16, borderWidth: 0.5, borderColor: colors.borderStrong },
  gameRequestFrom: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  gameRequestCourse: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  chatHeader: { backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: 0.5, borderBottomColor: colors.borderStrong },
  backTxt: { fontSize: 16, color: colors.primary, fontWeight: "600" },
  chatTitle: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  bubble: { maxWidth: "78%", padding: 12, borderRadius: 18 },
  bubbleMe: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: colors.surface, borderBottomLeftRadius: 4, borderWidth: 0.5, borderColor: colors.borderStrong },
  bubbleTxt: { fontSize: 14, color: colors.textPrimary, lineHeight: 20 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, backgroundColor: colors.surface, borderTopWidth: 0.5, borderTopColor: colors.borderStrong },
  inputMsg: { flex: 1, backgroundColor: "#f2f2f7", borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: colors.textPrimary },
  sendBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
})
