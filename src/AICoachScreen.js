import { useState, useEffect, useRef } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from './supabase'

const G = '#1B5E35'
const ANTHROPIC_KEY = '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'

export default function AICoachScreen() {
  const [players, setPlayers] = useState([])
  const [sessions, setSessions] = useState([])
  const [messages, setMessages] = useState([{ role: 'assistant', content: '' }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: p } = await supabase.from('players').select('*').eq('coach_id', user.id)
    const { data: s } = await supabase.from('sessions').select('*').eq('coach_id', user.id)
    setPlayers(p || [])
    setSessions(s || [])
    setMessages([{ role: 'assistant', content: `Hello Coach! I have access to your ${(p||[]).length} player(s) and ${(s||[]).length} session(s). How can I help you?` }])
    setDataLoaded(true)
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    const newMessages = [...messages, { role: 'user', content: userMsg }]
    setMessages(newMessages)
    setLoading(true)
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)

    try {
      const systemPrompt = `You are an AI coach assistant for FairwayPro. You help golf coaches manage their academy.
Players: ${JSON.stringify(players.map(p => ({ name: p.full_name, handicap: p.current_handicap })))}
Sessions: ${JSON.stringify(sessions.map(s => ({ player_id: s.player_id, date: s.session_date, price: s.price })))}
Total revenue: ${sessions.reduce((sum, s) => sum + (s.price || 0), 0)}€
Answer in the same language as the coach's question.`

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 500,
          system: systemPrompt,
          messages: newMessages.map(m => ({ role: m.role, content: m.content }))
        })
      })
      const data = await response.json()
      const reply = data.content?.[0]?.text || 'Sorry, I could not process your request.'
      setMessages([...newMessages, { role: 'assistant', content: reply }])
    } catch (e) {
      setMessages([...newMessages, { role: 'assistant', content: 'Connection error. Please try again.' }])
    }
    setLoading(false)
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>AI Coach</Text>
        <View style={s.dot} />
        <Text style={s.powered}>Powered by Claude</Text>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={90}>
        <ScrollView ref={scrollRef} style={s.scroll} contentContainerStyle={{ padding: 16 }}>
          {messages.map((m, i) => (
            <View key={i} style={[s.msgWrap, m.role === 'user' ? s.msgUser : s.msgAI]}>
              {m.role === 'assistant' && <Text style={s.aiLabel}>COACH IA</Text>}
              <View style={[s.bubble, m.role === 'user' ? s.bubbleUser : s.bubbleAI]}>
                <Text style={[s.bubbleTxt, m.role === 'user' && { color: '#fff' }]}>{m.content}</Text>
              </View>
            </View>
          ))}
          {loading && (
            <View style={s.msgAI}>
              <Text style={s.aiLabel}>COACH IA</Text>
              <View style={s.bubbleAI}>
                <ActivityIndicator color={G} size="small" />
              </View>
            </View>
          )}
        </ScrollView>
        <View style={s.inputRow}>
          <TextInput style={s.inputMsg} value={input} onChangeText={setInput} placeholder="Ask a question about your players..." placeholderTextColor="#9CA3AF" multiline onSubmitEditing={sendMessage} />
          <TouchableOpacity style={[s.sendBtn, (!input.trim() || loading) && { backgroundColor: '#c7c7cc' }]} onPress={sendMessage} disabled={!input.trim() || loading}>
            <Text style={s.sendTxt}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f8f8' },
  header: { backgroundColor: '#fff', padding: 20, paddingTop: 10, borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB', flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 24, fontWeight: '800', color: '#1a1a1a', letterSpacing: -0.5 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
  powered: { fontSize: 12, color: '#9CA3AF' },
  scroll: { flex: 1 },
  msgWrap: { marginBottom: 16 },
  msgUser: { alignItems: 'flex-end' },
  msgAI: { alignItems: 'flex-start' },
  aiLabel: { fontSize: 9, color: '#9CA3AF', fontWeight: '600', letterSpacing: 0.1, marginBottom: 4 },
  bubble: { maxWidth: '85%', padding: 14, borderRadius: 16 },
  bubbleUser: { backgroundColor: G, borderBottomRightRadius: 4 },
  bubbleAI: { backgroundColor: '#fff', borderBottomLeftRadius: 4, borderWidth: 0.5, borderColor: '#E5E7EB', minWidth: 60, minHeight: 44, justifyContent: 'center' },
  bubbleTxt: { fontSize: 14, color: '#1a1a1a', lineHeight: 21 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: '#fff', borderTopWidth: 0.5, borderTopColor: '#E5E7EB' },
  inputMsg: { flex: 1, backgroundColor: '#f2f2f7', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: '#1a1a1a', maxHeight: 100 },
  sendBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: G, alignItems: 'center', justifyContent: 'center' },
  sendTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
