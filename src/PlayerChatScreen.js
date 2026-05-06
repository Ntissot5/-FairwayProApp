import { useState, useEffect, useRef } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from './supabase'
import { useTranslation } from 'react-i18next'

const G = '#1B5E35'

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

  if (loading) return <View style={s.loading}><ActivityIndicator color={G} size="large" /></View>

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
                <Text style={[s.bubbleTxt, m.sender === 'player' && { color: '#fff' }]}>{m.content}</Text>
              </View>
              <Text style={s.time}>{new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={s.inputRow}>
          <TextInput style={s.inputMsg} value={input} onChangeText={setInput} placeholder="Message your coach..." placeholderTextColor="#9CA3AF" multiline />
          <TouchableOpacity style={[s.sendBtn, !input.trim() && { backgroundColor: '#c7c7cc' }]} onPress={sendMessage}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f8f8' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
  coachAv: { width: 44, height: 44, borderRadius: 22, backgroundColor: G, alignItems: 'center', justifyContent: 'center' },
  coachAvTxt: { color: '#fff', fontSize: 18, fontWeight: '700' },
  coachName: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  online: { fontSize: 11, color: '#22c55e', fontWeight: '600' },
  messages: { flex: 1 },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 40 },
  bubble: { maxWidth: '80%', padding: 14, borderRadius: 18 },
  bubbleCoach: { backgroundColor: '#fff', borderBottomLeftRadius: 4, borderWidth: 0.5, borderColor: '#E5E7EB' },
  bubblePlayer: { backgroundColor: G, borderBottomRightRadius: 4 },
  bubbleTxt: { fontSize: 14, color: '#1a1a1a', lineHeight: 21 },
  time: { fontSize: 10, color: '#9CA3AF', marginTop: 4, paddingHorizontal: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: '#fff', borderTopWidth: 0.5, borderTopColor: '#E5E7EB' },
  inputMsg: { flex: 1, backgroundColor: '#f2f2f7', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: '#1a1a1a', maxHeight: 100 },
  sendBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: G, alignItems: 'center', justifyContent: 'center' },
})
