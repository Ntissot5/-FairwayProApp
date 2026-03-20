import { useState, useEffect } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity, Share, Alert, Modal, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from './supabase'

const G = '#1B5E35'

export default function RevenueScreen({ navigation }) {
  const [players, setPlayers] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showAddSession, setShowAddSession] = useState(false)
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [newSession, setNewSession] = useState({ player_id: '', price: '', session_date: new Date().toISOString().split('T')[0], notes: '' })
  const [newPlayerName, setNewPlayerName] = useState('')
  const [newPlayerHcp, setNewPlayerHcp] = useState('')
  const [savingS, setSavingS] = useState(false)
  const [savingP, setSavingP] = useState(false)
  const [userId, setUserId] = useState(null)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user.id)
    const { data: p } = await supabase.from('players').select('*').eq('coach_id', user.id)
    const { data: s } = await supabase.from('sessions').select('*').eq('coach_id', user.id).order('session_date', { ascending: false })
    setPlayers(p || [])
    setSessions(s || [])
    setLoading(false)
    setRefreshing(false)
  }

  const exportRevenue = async () => {
    const lines = ['FairwayPro — Revenue Export', '========================', '']
    lines.push('TOTAL: ' + total + '€ (' + sessions.length + ' sessions)')
    lines.push('CE MOIS: ' + thisMonth + '€')
    lines.push('MOYENNE: ' + avg + '€/session')
    lines.push('')
    lines.push('SESSION DETAILS:')
    lines.push('------------------------')
    sessions.forEach(s => {
      const player = players.find(p => p.id === s.player_id)
      lines.push(s.session_date + ' — ' + (player?.full_name || '—') + ' — ' + s.price + '€')
    })
    try {
      await Share.share({ message: lines.join('\n'), title: 'FairwayPro Revenue' })
    } catch(e) { Alert.alert('Error', e.message) }
  }

  const addSession = async () => {
    if (!newSession.player_id || !newSession.price) return
    setSavingS(true)
    await supabase.from('sessions').insert({ coach_id: userId, player_id: newSession.player_id, price: parseFloat(newSession.price), session_date: newSession.session_date, notes: newSession.notes, paid: true })
    setNewSession({ player_id: '', price: '', session_date: new Date().toISOString().split('T')[0], notes: '' })
    setShowAddSession(false)
    setSavingS(false)
    fetchAll()
  }

  const addPlayer = async () => {
    if (!newPlayerName) return
    setSavingP(true)
    await supabase.from('players').insert({ coach_id: userId, full_name: newPlayerName, current_handicap: parseFloat(newPlayerHcp) || 0 })
    setNewPlayerName('')
    setNewPlayerHcp('')
    setShowAddPlayer(false)
    setSavingP(false)
    fetchAll()
  }

  const now = new Date()
  const total = sessions.reduce((sum, s) => sum + (s.price || 0), 0)
  const thisMonth = sessions.filter(s => { const d = new Date(s.session_date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() }).reduce((sum, s) => sum + (s.price || 0), 0)
  const avg = sessions.length > 0 ? Math.round(total / sessions.length) : 0

  if (loading) return <View style={s.loading}><ActivityIndicator color={G} size="large" /></View>

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>Revenue</Text>
          <Text style={s.sub}>{sessions.length} sessions</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TouchableOpacity onPress={exportRevenue} style={s.btn2}>
            <Text style={s.btn2Txt}>↑ Export</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btn2, { borderColor: G }]} onPress={() => setShowAddSession(true)}>
            <Text style={[s.btn2Txt, { color: G }]}>+ Session</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btn2, { backgroundColor: G, borderColor: G }]} onPress={() => setShowAddPlayer(true)}>
            <Text style={[s.btn2Txt, { color: '#fff' }]}>+ Player</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={s.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll() }} tintColor={G} />}>
        <View style={s.statsRow}>
          {[{label:'TOTAL REVENUE', value: total+'€', sub: sessions.length+' sessions'}, {label:'THIS MONTH', value: thisMonth+'€'}, {label:'AVG/SESSION', value: avg+'€'}].map((item, i) => (
            <View key={i} style={[s.stat, i === 0 && s.statGreen]}>
              <Text style={s.statLabel}>{item.label}</Text>
              <Text style={[s.statValue, i === 0 && { color: G }]}>{item.value}</Text>
            </View>
          ))}
        </View>
        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>Session details</Text>
            <Text style={s.sectionSub}>{sessions.length} recorded</Text>
          </View>
          {sessions.map(session => {
            const player = players.find(p => p.id === session.player_id)
            return (
              <TouchableOpacity key={session.id} style={s.row} onPress={() => player && navigation.navigate('PlayerDetail', { player })}>
                <View style={s.rowInfo}>
                  <Text style={s.rowName}>{player?.full_name || '—'}</Text>
                  <Text style={s.rowDate}>{session.session_date}</Text>
                </View>
                <Text style={s.rowPrice}>{session.price}€</Text>
                <View style={s.paidBadge}><Text style={s.paidTxt}>✓ Paid</Text></View>
              </TouchableOpacity>
            )
          })}
        </View>
        <View style={{ height: 40 }} />
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
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { backgroundColor: '#fff', padding: 16, paddingTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
  title: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', letterSpacing: -0.5 },
  sub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  btn2: { backgroundColor: '#F8FAF8', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  btn2Txt: { fontSize: 11, fontWeight: '600', color: '#374151' },
  scroll: { flex: 1 },
  statsRow: { padding: 16, gap: 10 },
  stat: { backgroundColor: '#fff', borderRadius: 14, padding: 18, borderWidth: 0.5, borderColor: '#E5E7EB', marginBottom: 2 },
  statGreen: { borderTopWidth: 3, borderTopColor: G },
  statLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '600', marginBottom: 8 },
  statValue: { fontSize: 36, fontWeight: '800', color: '#1a1a1a', letterSpacing: -1 },
  section: { backgroundColor: '#fff', borderRadius: 16, margin: 16, marginTop: 0, borderWidth: 0.5, borderColor: '#E5E7EB', overflow: 'hidden' },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 0.5, borderBottomColor: '#F0F4F0' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  sectionSub: { fontSize: 12, color: '#9CA3AF' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 0.5, borderBottomColor: '#F8FAF8' },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 13, fontWeight: '500', color: '#1a1a1a' },
  rowDate: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  rowPrice: { fontSize: 15, fontWeight: '700', color: G, marginRight: 10 },
  paidBadge: { backgroundColor: '#E8F5EE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  paidTxt: { fontSize: 10, fontWeight: '600', color: G },
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
