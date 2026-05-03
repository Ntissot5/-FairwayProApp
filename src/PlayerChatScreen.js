import { useState, useEffect, useRef, useMemo } from 'react'
import { View, Text, ScrollView, StyleSheet, TextInput, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from './supabase'
import { useTheme } from './ThemeContext'
import { useTranslation } from 'react-i18next'
import AnimatedPressable from './components/AnimatedPressable'
import Skeleton from './components/Skeleton'

export default function PlayerChatScreen() {
  const { colors } = useTheme()
  const { t } = useTranslation()
  const s = useMemo(() => makeStyles(colors), [colors])
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [myPlayer, setMyPlayer] = useState(null)
  const scrollRef = useRef(null)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: player } = await supabase.from('players').select('*, coaches:coach_id(*)').eq('player_user_id', user.id).single()
    setMyPlayer(player)
    const { data: msgs } = await supabase.from('messages').select('*').eq('player_id', player?.id).order('created_at', { ascending: true })
    setMessages(msgs || [])
    setLoading(false)
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100)
  }

  const sendMessage = async () => {
    if (!input.trim() || !myPlayer) return
    await supabase.from('messages').insert({ coach_id: myPlayer.coach_id, player_id: myPlayer.id, sender: 'player', content: input.trim() })
    setInput('')
    fetchAll()
  }

  if (loading) return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Skeleton width={44} height={44} borderRadius={22} />
        <View style={{ gap: 6 }}>
          <Skeleton width={100} height={14} borderRadius={4} />
          <Skeleton width={50} height={10} borderRadius={4} />
        </View>
      </View>
      <View style={{ padding: 16, gap: 16 }}>
        <View style={{ alignItems: 'flex-start' }}><Skeleton width={200} height={44} borderRadius={18} /></View>
        <View style={{ alignItems: 'flex-end' }}><Skeleton width={160} height={44} borderRadius={18} /></View>
        <View style={{ alignItems: 'flex-start' }}><Skeleton width={220} height={60} borderRadius={18} /></View>
      </View>
    </SafeAreaView>
  )

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <View style={s.coachAv}>
          <Text style={s.coachAvTxt}>C</Text>
        </View>
        <View>
          <Text style={s.coachName}>{t('playerChat.yourCoach')}</Text>
          <Text style={s.online}>{t('playerChat.online')}</Text>
        </View>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={90}>
        <ScrollView ref={scrollRef} style={s.messages} contentContainerStyle={{ padding: 16 }}>
          {messages.length === 0 && <Text style={s.empty}>{t('playerChat.noMessages')}</Text>}
          {messages.map(m => (
            <View key={m.id} style={{ alignItems: m.sender === 'player' ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
              <View style={[s.bubble, m.sender === 'player' ? s.bubblePlayer : s.bubbleCoach]}>
                <Text style={[s.bubbleTxt, m.sender === 'player' && { color: '#fff' }]}>{m.content}</Text>
              </View>
              <Text style={s.time}>{new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={s.inputRow}>
          <TextInput style={s.inputMsg} value={input} onChangeText={setInput} placeholder={t('playerChat.placeholder')} placeholderTextColor={colors.textTertiary} multiline />
          <AnimatedPressable style={[s.sendBtn, !input.trim() && { backgroundColor: colors.separator }]} onPress={sendMessage}>
            <Ionicons name="arrow-up" size={18} color="#fff" />
          </AnimatedPressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bgSecondary },
  header: { backgroundColor: c.card, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 0.5, borderBottomColor: c.separator },
  coachAv: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  coachAvTxt: { color: '#fff', fontSize: 18, fontWeight: '700' },
  coachName: { fontSize: 15, fontWeight: '700', color: c.text },
  online: { fontSize: 11, color: '#22c55e', fontWeight: '600' },
  messages: { flex: 1 },
  empty: { textAlign: 'center', color: c.textTertiary, marginTop: 40 },
  bubble: { maxWidth: '80%', padding: 14, borderRadius: 18 },
  bubbleCoach: { backgroundColor: c.card, borderBottomLeftRadius: 4, borderWidth: 0.5, borderColor: c.separator },
  bubblePlayer: { backgroundColor: c.primary, borderBottomRightRadius: 4 },
  bubbleTxt: { fontSize: 14, color: c.text, lineHeight: 21 },
  time: { fontSize: 10, color: c.textTertiary, marginTop: 4, paddingHorizontal: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: c.card, borderTopWidth: 0.5, borderTopColor: c.separator },
  inputMsg: { flex: 1, backgroundColor: c.bgSecondary, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: c.text, maxHeight: 100 },
  sendBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
})
