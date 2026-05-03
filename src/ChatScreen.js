import { useState, useEffect, useRef, useMemo } from 'react'
import { View, Text, ScrollView, StyleSheet, TextInput, KeyboardAvoidingView, Platform, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from './supabase'
import { sendPushNotification } from './notifications'
import { useTheme } from './ThemeContext'
import { useTranslation } from 'react-i18next'
import AnimatedPressable from './components/AnimatedPressable'
import AnimatedListItem from './components/AnimatedListItem'

export default function ChatScreen({ navigation }) {
  const { colors } = useTheme()
  const { t } = useTranslation()
  const s = useMemo(() => makeStyles(colors), [colors])
  const [players, setPlayers] = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [coachId, setCoachId] = useState(null)
  const scrollRef = useRef(null)
  const avatarColors = colors.avatarColors

  useEffect(() => { fetchPlayers() }, [])
  useEffect(() => { if (selected) fetchMessages() }, [selected])

  const fetchPlayers = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCoachId(user.id)
    const { data } = await supabase.from('players').select('*').eq('coach_id', user.id)
    setPlayers(data || [])
  }

  const fetchMessages = async () => {
    const { data } = await supabase.from('messages').select('*').eq('player_id', selected.id).order('created_at', { ascending: true })
    setMessages(data || [])
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
  }

  const sendMessage = async () => {
    if (!input.trim()) return
    await supabase.from('messages').insert({ coach_id: coachId, player_id: selected.id, sender: 'coach', content: input.trim() })
    const { data: tokenRow } = await supabase.from('push_tokens').select('token').eq('user_id', selected.player_user_id).single()
    if (tokenRow?.token) {
      await sendPushNotification(tokenRow.token, 'Nouveau message de ton coach', input.trim().slice(0, 80), { type: 'message' })
    }
    setInput('')
    fetchMessages()
  }

  if (selected) return (
    <SafeAreaView style={s.safe}>
      <View style={s.chatHeader}>
        <AnimatedPressable onPress={() => setSelected(null)} haptic={false}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </AnimatedPressable>
        <Text style={s.chatTitle}>{selected.full_name}</Text>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={90}>
        <ScrollView ref={scrollRef} style={s.messages} contentContainerStyle={{ padding: 16, paddingBottom: 20 }}>
          {messages.length === 0 && <Text style={s.empty}>{t('chat.noMessages')}</Text>}
          {messages.map(m => (
            <View key={m.id} style={{ alignItems: m.sender === 'coach' ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
              <View style={[s.bubble, m.sender === 'coach' ? s.bubbleCoach : s.bubblePlayer]}>
                <Text style={[s.bubbleTxt, m.sender === 'coach' && { color: '#fff' }]}>{m.content}</Text>
              </View>
              <Text style={s.time}>{new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={s.inputRow}>
          <TextInput style={s.inputMsg} value={input} onChangeText={setInput} placeholder={t('chat.messagePlaceholder', { name: selected.full_name })} placeholderTextColor={colors.textTertiary} multiline />
          <AnimatedPressable style={[s.sendBtn, !input.trim() && { backgroundColor: colors.separator }]} onPress={sendMessage}>
            <Ionicons name="arrow-up" size={18} color="#fff" />
          </AnimatedPressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>{t('chat.title')}</Text>
        <Text style={s.sub}>{t('chat.conversations')}</Text>
      </View>
      <ScrollView style={s.scroll}>
        {players.map((p, i) => (
          <AnimatedListItem key={p.id} index={i}>
            <AnimatedPressable style={s.playerRow} onPress={() => setSelected(p)} onLongPress={() => navigation.navigate('Space', { player: p })}>
              <View style={[s.av, { backgroundColor: avatarColors[i % avatarColors.length] }]}>
                <Text style={s.avTxt}>{p.full_name?.charAt(0)}</Text>
              </View>
              <View style={s.playerInfo}>
                <Text style={s.playerName}>{p.full_name}</Text>
                <Text style={s.playerSub}>HCP {p.current_handicap}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </AnimatedPressable>
          </AnimatedListItem>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bgSecondary },
  header: { backgroundColor: c.card, padding: 16, paddingTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 0.5, borderBottomColor: c.separator },
  title: { fontSize: 22, fontWeight: '800', color: c.text, letterSpacing: -0.5 },
  sub: { fontSize: 12, color: c.textTertiary, marginTop: 2 },
  scroll: { flex: 1 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: c.card, borderBottomWidth: 0.5, borderBottomColor: c.separatorLight },
  av: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  playerInfo: { flex: 1 },
  playerName: { fontSize: 15, fontWeight: '600', color: c.text },
  playerSub: { fontSize: 12, color: c.textTertiary, marginTop: 2 },
  chatHeader: { backgroundColor: c.card, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 0.5, borderBottomColor: c.separator },
  chatTitle: { fontSize: 16, fontWeight: '700', color: c.text },
  messages: { flex: 1, backgroundColor: c.bgSecondary },
  empty: { textAlign: 'center', color: c.textTertiary, marginTop: 40, fontSize: 13 },
  bubble: { maxWidth: '78%', padding: 12, borderRadius: 18 },
  bubbleCoach: { backgroundColor: c.primary, borderBottomRightRadius: 4 },
  bubblePlayer: { backgroundColor: c.card, borderBottomLeftRadius: 4, borderWidth: 0.5, borderColor: c.separator },
  bubbleTxt: { fontSize: 14, color: c.text, lineHeight: 20 },
  time: { fontSize: 10, color: c.textTertiary, marginTop: 3, paddingHorizontal: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: c.card, borderTopWidth: 0.5, borderTopColor: c.separator },
  inputMsg: { flex: 1, backgroundColor: c.bgSecondary, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: c.text, maxHeight: 100 },
  sendBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
})
