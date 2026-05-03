import { useState, useEffect, useRef, useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from './supabase'
import { useTheme } from './ThemeContext'
import { useTranslation } from 'react-i18next'
import AnimatedPressable from './components/AnimatedPressable'
import AnimatedListItem from './components/AnimatedListItem'
import { PlayerListSkeleton } from './components/Skeleton'

export default function PlayerCommunityScreen() {
  const { colors } = useTheme()
  const { t } = useTranslation()
  const s = useMemo(() => makeStyles(colors), [colors])
  const [tab, setTab] = useState('golfers')
  const [players, setPlayers] = useState([])
  const [gameRequests, setGameRequests] = useState([])
  const [myPlayer, setMyPlayer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [chatMessages, setChatMessages] = useState([])
  const [input, setInput] = useState('')
  const scrollRef = useRef(null)
  const avatarColors = colors.avatarColors

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
    await supabase.from('game_requests').insert({ from_player_id: myPlayer.id, to_player_id: toPlayer.id, course_name: 'A definir', game_date: date.toISOString().split('T')[0], status: 'pending' })
    Alert.alert(t('community.inviteSent', { name: toPlayer.full_name }))
  }

  if (selectedPlayer) return (
    <SafeAreaView style={s.safe}>
      <View style={s.chatHeader}>
        <AnimatedPressable onPress={() => setSelectedPlayer(null)} haptic={false}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </AnimatedPressable>
        <Text style={s.chatTitle}>{selectedPlayer.full_name}</Text>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={90}>
        <ScrollView ref={scrollRef} style={{ flex: 1, backgroundColor: colors.bgSecondary }} contentContainerStyle={{ padding: 16 }}>
          {chatMessages.map(m => (
            <View key={m.id} style={{ alignItems: m.sender_id === myPlayer?.id ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
              <View style={[s.bubble, m.sender_id === myPlayer?.id ? s.bubbleMe : s.bubbleThem]}>
                <Text style={[s.bubbleTxt, m.sender_id === myPlayer?.id && { color: '#fff' }]}>{m.content}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
        <View style={s.inputRow}>
          <TextInput style={s.inputMsg} value={input} onChangeText={setInput} placeholder="Message..." placeholderTextColor={colors.textTertiary} />
          <AnimatedPressable style={s.sendBtn} onPress={sendMessage}>
            <Ionicons name="arrow-up" size={18} color="#fff" />
          </AnimatedPressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )

  if (loading) return <SafeAreaView style={s.safe}><View style={s.header}><Text style={s.title}>{t('community.title')}</Text></View><PlayerListSkeleton /></SafeAreaView>

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>{t('community.title')}</Text>
        <Text style={s.sub}>{t('community.subtitle')}</Text>
      </View>
      <View style={s.tabs}>
        {[{key:'golfers',label:t('community.golfers')},{key:'messages',label:t('community.messages')},{key:'parties',label:t('community.parties')}].map(tItem => (
          <AnimatedPressable key={tItem.key} style={[s.tab, tab === tItem.key && s.tabActive]} onPress={() => setTab(tItem.key)} haptic={false}>
            <Text style={[s.tabTxt, tab === tItem.key && s.tabTxtActive]}>{tItem.label}</Text>
          </AnimatedPressable>
        ))}
      </View>
      <ScrollView style={s.scroll}>
        {tab === 'golfers' && (
          <>
            <Text style={s.countLabel}>{t('community.golfersCount', { count: players.length })}</Text>
            {players.map((p, i) => (
              <AnimatedListItem key={p.id} index={i}>
                <View style={s.playerCard}>
                  <View style={[s.av, { backgroundColor: avatarColors[i % avatarColors.length] }]}>
                    <Text style={s.avTxt}>{p.full_name?.slice(0,2).toUpperCase()}</Text>
                  </View>
                  <View style={s.playerInfo}>
                    <Text style={s.playerName}>{p.full_name}</Text>
                  </View>
                  <Text style={s.hcp}>{p.current_handicap || 0}</Text>
                  <Text style={s.hcpLabel}>HCP</Text>
                  <AnimatedPressable style={s.msgBtn} onPress={() => setSelectedPlayer(p)}>
                    <Ionicons name="chatbubble-outline" size={12} color={colors.textSecondary} />
                    <Text style={s.msgBtnTxt}>{t('community.message')}</Text>
                  </AnimatedPressable>
                  <AnimatedPressable style={s.gameBtn} onPress={() => requestGame(p)}>
                    <Ionicons name="flag-outline" size={12} color="#fff" />
                    <Text style={s.gameBtnTxt}>{t('community.game')}</Text>
                  </AnimatedPressable>
                </View>
              </AnimatedListItem>
            ))}
          </>
        )}
        {tab === 'messages' && (
          <>
            {players.length === 0 ? <Text style={s.empty}>{t('chat.noMessages')}</Text> : players.map((p, i) => (
              <AnimatedPressable key={p.id} style={s.msgRow} onPress={() => setSelectedPlayer(p)}>
                <View style={[s.av, { backgroundColor: avatarColors[i % avatarColors.length] }]}>
                  <Text style={s.avTxt}>{p.full_name?.slice(0,2).toUpperCase()}</Text>
                </View>
                <View style={s.playerInfo}>
                  <Text style={s.playerName}>{p.full_name}</Text>
                  <Text style={s.msgPreview}>{t('community.tapToMessage')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
              </AnimatedPressable>
            ))}
          </>
        )}
        {tab === 'parties' && (
          <>
            {gameRequests.length === 0 ? <Text style={s.empty}>{t('community.noGameRequests')}</Text> : gameRequests.map(gr => (
              <View key={gr.id} style={s.gameRequestCard}>
                <Text style={s.gameRequestFrom}>{gr.players?.full_name} {t('community.invitesYou')}</Text>
                <Text style={s.gameRequestCourse}>{gr.course_name} · {gr.game_date}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <AnimatedPressable style={[s.gameBtn, { flex: 1, alignItems: 'center' }]}
                    onPress={async () => { await supabase.from('game_requests').update({ status: 'accepted' }).eq('id', gr.id); fetchAll() }}>
                    <Ionicons name="checkmark" size={14} color="#fff" />
                    <Text style={s.gameBtnTxt}>{t('community.accept')}</Text>
                  </AnimatedPressable>
                  <AnimatedPressable style={[s.msgBtn, { flex: 1, alignItems: 'center' }]}
                    onPress={async () => { await supabase.from('game_requests').update({ status: 'declined' }).eq('id', gr.id); fetchAll() }}>
                    <Ionicons name="close" size={14} color={colors.textSecondary} />
                    <Text style={s.msgBtnTxt}>{t('community.decline')}</Text>
                  </AnimatedPressable>
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

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bgSecondary },
  header: { backgroundColor: c.card, padding: 16, paddingTop: 10, borderBottomWidth: 0.5, borderBottomColor: c.separator },
  title: { fontSize: 22, fontWeight: '800', color: c.text },
  sub: { fontSize: 12, color: c.textTertiary, marginTop: 2 },
  tabs: { flexDirection: 'row', backgroundColor: c.card, padding: 4, margin: 16, marginBottom: 8, borderRadius: 12, borderWidth: 0.5, borderColor: c.separator },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: c.primary },
  tabTxt: { fontSize: 13, fontWeight: '600', color: c.textTertiary },
  tabTxtActive: { color: '#fff' },
  scroll: { flex: 1 },
  countLabel: { fontSize: 11, fontWeight: '700', color: c.textTertiary, paddingHorizontal: 16, marginBottom: 8, letterSpacing: 0.5 },
  playerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, padding: 14, borderBottomWidth: 0.5, borderBottomColor: c.separatorLight, gap: 8 },
  av: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
  playerInfo: { flex: 1 },
  playerName: { fontSize: 14, fontWeight: '600', color: c.text },
  hcp: { fontSize: 16, fontWeight: '800', color: c.primary },
  hcpLabel: { fontSize: 9, color: c.textTertiary },
  msgBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.inputBg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 0.5, borderColor: c.separator },
  msgBtnTxt: { fontSize: 11, fontWeight: '600', color: c.textSecondary },
  gameBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.primary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  gameBtnTxt: { fontSize: 11, fontWeight: '600', color: '#fff' },
  msgRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, padding: 16, borderBottomWidth: 0.5, borderBottomColor: c.separatorLight, gap: 12 },
  msgPreview: { fontSize: 12, color: c.textTertiary, marginTop: 2 },
  empty: { textAlign: 'center', color: c.textTertiary, padding: 40 },
  gameRequestCard: { backgroundColor: c.card, margin: 16, marginBottom: 8, borderRadius: 14, padding: 16, borderWidth: 0.5, borderColor: c.separator },
  gameRequestFrom: { fontSize: 15, fontWeight: '700', color: c.text },
  gameRequestCourse: { fontSize: 13, color: c.textTertiary, marginTop: 4 },
  chatHeader: { backgroundColor: c.card, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 0.5, borderBottomColor: c.separator },
  chatTitle: { fontSize: 16, fontWeight: '700', color: c.text },
  bubble: { maxWidth: '78%', padding: 12, borderRadius: 18 },
  bubbleMe: { backgroundColor: c.primary, borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: c.card, borderBottomLeftRadius: 4, borderWidth: 0.5, borderColor: c.separator },
  bubbleTxt: { fontSize: 14, color: c.text, lineHeight: 20 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: c.card, borderTopWidth: 0.5, borderTopColor: c.separator },
  inputMsg: { flex: 1, backgroundColor: c.bgSecondary, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: c.text },
  sendBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
})
