import { useState, useEffect, useRef } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, KeyboardAvoidingView, Platform, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from './supabase'

const G = '#1B5E35'
const colors = ['#1B5E35','#0891B2','#7C3AED','#DC2626','#D97706','#059669']

export default function ChatScreen({ navigation }) {
  const [players, setPlayers] = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [coachId, setCoachId] = useState(null)
  const [showAddSession, setShowAddSession] = useState(false)
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [newSession, setNewSession] = useState({ player_id: '', price: '', session_date: new Date().toISOString().split('T')[0], notes: '' })
  const [newPlayerName, setNewPlayerName] = useState('')
  const [newPlayerHcp, setNewPlayerHcp] = useState('')
  const [savingS, setSavingS] = useState(false)
  const [savingP, setSavingP] = useState(false)
  const scrollRef = useRef(null)

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
    setInput('')
    fetchMessages()
  }

  const addSession = async () => {
    if (!newSession.player_id || !newSession.price) return
    setSavingS(true)
    await supabase.from('sessions').insert({ coach_id: coachId, player_id: newSession.player_id, price: parseFloat(newSession.price), session_date: newSession.session_date, notes: newSession.notes, paid: true })
    setNewSession({ player_id: '', price: '', session_date: new Date().toISOString().split('T')[0], notes: '' })
    setShowAddSession(false)
    setSavingS(false)
  }

  const addPlayer = async () => {
    if (!newPlayerName) return
    setSavingP(true)
    await supabase.from('players').insert({ coach_id: coachId, full_name: newPlayerName, current_handicap: parseFloat(newPlayerHcp) || 0 })
    setNewPlayerName('')
    setNewPlayerHcp('')
    setShowAddPlayer(false)
    setSavingP(false)
    fetchPlayers()
  }

  if (selected) return (
    <SafeAreaView style={s.safe}>
      <View style={s.chatHeader}>
        <TouchableOpacity onPress={() => setSelected(null)} style={s.backBtn}>
          <Text style={s.backTxt}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={s.chatTitle}>{selected.full_name}</Text>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={90}>
        <ScrollView ref={scrollRef} style={s.messages} contentContainerStyle={{ padding: 16, paddingBottom: 20 }}>
          {messages.length === 0 && <Text style={s.empty}>No messages yet</Text>}
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
          <TextInput style={s.inputMsg} value={input} onChangeText={setInput} placeholder={"Message " + selected.full_name + "..."} placeholderTextColor="#9CA3AF" multiline />
          <TouchableOpacity style={[s.sendBtn, !input.trim() && { backgroundColor: '#c7c7cc' }]} onPress={sendMessage}>
            <Text style={s.sendTxt}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>Chat</Text>
          <Text style={s.sub}>Conversations</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TouchableOpacity style={s.btn2} onPress={() => setShowAddSession(true)}>
            <Text style={s.btn2Txt}>+ Session</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btn2, { backgroundColor: G, borderColor: G }]} onPress={() => setShowAddPlayer(true)}>
            <Text style={[s.btn2Txt, { color: '#fff' }]}>+ Player</Text>
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView style={s.scroll}>
        {players.map((p, i) => (
          <TouchableOpacity key={p.id} style={s.playerRow} onPress={() => setSelected(p)} onLongPress={() => navigation.navigate('PlayerDetail', { player: p })}>
            <View style={[s.av, { backgroundColor: colors[i % colors.length] }]}>
              <Text style={s.avTxt}>{p.full_name?.charAt(0)}</Text>
            </View>
            <View style={s.playerInfo}>
              <Text style={s.playerName}>{p.full_name}</Text>
              <Text style={s.playerSub}>HCP {p.current_handicap}</Text>
            </View>
            <Text style={s.arrow}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={showAddSession} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={s.modalHead}>
            <Text style={s.modalTitle}>Add a session</Text>
            <TouchableOpacity onPress={() => setShowAddSession(false)}>
              <Text style={s.modalClose}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }}>
            <Text style={s.label}>Player</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {players.map(p => (
                <TouchableOpacity key={p.id} onPress={() => setNewSession({...newSession, player_id: p.id})} style={[s.chip, newSession.player_id === p.id && s.chipActive]}>
                  <Text style={[s.chipTxt, newSession.player_id === p.id && { color: '#fff' }]}>{p.full_name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={s.label}>Price (€)</Text>
            <TextInput style={s.input} value={newSession.price} onChangeText={v => setNewSession({...newSession, price: v})} placeholder="120" keyboardType="decimal-pad" placeholderTextColor="#9CA3AF" />
            <Text style={s.label}>Date</Text>
            <TextInput style={s.input} value={newSession.session_date} onChangeText={v => setNewSession({...newSession, session_date: v})} placeholderTextColor="#9CA3AF" />
            <TouchableOpacity style={[s.submitBtn, savingS && { opacity: 0.7 }]} onPress={addSession} disabled={savingS}>
              <Text style={s.submitTxt}>{savingS ? 'Adding...' : '+ Add session'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={showAddPlayer} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={s.modalHead}>
            <Text style={s.modalTitle}>Add a player</Text>
            <TouchableOpacity onPress={() => setShowAddPlayer(false)}>
              <Text style={s.modalClose}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <View style={{ padding: 20 }}>
            <Text style={s.label}>Full name</Text>
            <TextInput style={s.input} value={newPlayerName} onChangeText={setNewPlayerName} placeholder="Emma Wilson" placeholderTextColor="#9CA3AF" />
            <Text style={s.label}>Handicap</Text>
            <TextInput style={s.input} value={newPlayerHcp} onChangeText={setNewPlayerHcp} placeholder="8.2" keyboardType="decimal-pad" placeholderTextColor="#9CA3AF" />
            <TouchableOpacity style={[s.submitBtn, savingP && { opacity: 0.7 }]} onPress={addPlayer} disabled={savingP}>
              <Text style={s.submitTxt}>{savingP ? 'Adding...' : '+ Add player'}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f8f8' },
  header: { backgroundColor: '#fff', padding: 16, paddingTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
  title: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', letterSpacing: -0.5 },
  sub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  btn2: { backgroundColor: '#F8FAF8', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  btn2Txt: { fontSize: 11, fontWeight: '600', color: '#374151' },
  scroll: { flex: 1 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#F0F4F0' },
  av: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  playerInfo: { flex: 1 },
  playerName: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  playerSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  arrow: { fontSize: 22, color: '#9CA3AF' },
  chatHeader: { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
  backBtn: { paddingRight: 8 },
  backTxt: { fontSize: 16, color: G, fontWeight: '600' },
  chatTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  messages: { flex: 1, backgroundColor: '#f8f8f8' },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 40, fontSize: 13 },
  bubble: { maxWidth: '78%', padding: 12, borderRadius: 18 },
  bubbleCoach: { backgroundColor: G, borderBottomRightRadius: 4 },
  bubblePlayer: { backgroundColor: '#fff', borderBottomLeftRadius: 4, borderWidth: 0.5, borderColor: '#E5E7EB' },
  bubbleTxt: { fontSize: 14, color: '#1a1a1a', lineHeight: 20 },
  time: { fontSize: 10, color: '#9CA3AF', marginTop: 3, paddingHorizontal: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: '#fff', borderTopWidth: 0.5, borderTopColor: '#E5E7EB' },
  inputMsg: { flex: 1, backgroundColor: '#f2f2f7', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: '#1a1a1a', maxHeight: 100 },
  sendBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: G, alignItems: 'center', justifyContent: 'center' },
  sendTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  modalClose: { fontSize: 16, color: G, fontWeight: '600' },
  label: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: '#F8FAF8', borderWidth: 1, borderColor: '#E0E5E0', borderRadius: 12, padding: 14, fontSize: 15, color: '#1a1a1a' },
  chip: { backgroundColor: '#F8FAF8', borderWidth: 1, borderColor: '#E0E5E0', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  chipActive: { backgroundColor: G, borderColor: G },
  chipTxt: { fontSize: 13, color: '#1a1a1a', fontWeight: '500' },
  submitBtn: { backgroundColor: G, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 24, marginBottom: 40 },
  submitTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
