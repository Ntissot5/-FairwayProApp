import { useState, useEffect, useRef } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from './supabase'
import { useTranslation } from 'react-i18next'
import { colors } from './theme'

export default function PlayerChatScreen() {
  const { t } = useTranslation()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [myPlayer, setMyPlayer] = useState(null)
  const [coach, setCoach] = useState(null)
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

  if (loading) return <View style={s.loading}><ActivityIndicator color={colors.primary} size="large" /></View>

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <View style={s.coachAv}>
          <Text style={s.coachAvTxt}>C</Text>
        </View>
        <View>
          <Text style={s.coachName}>{t('player_chat.your_coach')}</Text>
          <Text style={s.online}>{t('player_chat.online')}</Text>
        </View>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={90}>
        <ScrollView ref={scrollRef} style={s.messages} contentContainerStyle={{ padding: 16 }}>
          {messages.length === 0 && <Text style={s.empty}>{t('player_chat.no_messages')}</Text>}
          {messages.map(m => (
            <View key={m.id} style={{ alignItems: m.sender === 'player' ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
              <View style={[s.bubble, m.sender === 'player' ? s.bubblePlayer : s.bubbleCoach]}>
                <Text style={[s.bubbleTxt, m.sender === 'player' && { color: colors.textInverse }]}>{m.content}</Text>
              </View>
              <Text style={s.time}>{new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={s.inputRow}>
          <TextInput style={s.inputMsg} value={input} onChangeText={setInput} placeholder="Message your coach..." placeholderTextColor={colors.textTertiary} multiline />
          <TouchableOpacity style={[s.sendBtn, !input.trim() && { backgroundColor: '#c7c7cc' }]} onPress={sendMessage}>
            <Text style={{ color: colors.textInverse, fontSize: 16, fontWeight: '700' }}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surfaceElevated },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 0.5, borderBottomColor: colors.borderStrong },
  coachAv: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  coachAvTxt: { color: colors.textInverse, fontSize: 18, fontWeight: '700' },
  coachName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  online: { fontSize: 11, color: '#22c55e', fontWeight: '600' },
  messages: { flex: 1 },
  empty: { textAlign: 'center', color: colors.textTertiary, marginTop: 40 },
  bubble: { maxWidth: '80%', padding: 14, borderRadius: 18 },
  bubbleCoach: { backgroundColor: colors.surface, borderBottomLeftRadius: 4, borderWidth: 0.5, borderColor: colors.borderStrong },
  bubblePlayer: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleTxt: { fontSize: 14, color: colors.textPrimary, lineHeight: 21 },
  time: { fontSize: 10, color: colors.textTertiary, marginTop: 4, paddingHorizontal: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: colors.surface, borderTopWidth: 0.5, borderTopColor: colors.borderStrong },
  inputMsg: { flex: 1, backgroundColor: '#f2f2f7', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: colors.textPrimary, maxHeight: 100 },
  sendBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
})
