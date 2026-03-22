import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, TextInput, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from './supabase'

const G = '#1B5E35'

export default function PlayersScreen({ navigation }) {
  const [players, setPlayers] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [newPlayer, setNewPlayer] = useState({ full_name: '', current_handicap: '' })
  const [saving, setSaving] = useState(false)
  const [showAddSession, setShowAddSession] = useState(false)
  const [newSession, setNewSession] = useState({ player_id: '', price: '', session_date: new Date().toISOString().split('T')[0], notes: '' })
  const [savingSession, setSavingSession] = useState(false)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: p } = await supabase.from('players').select('*').eq('coach_id', user.id)
    const { data: s } = await supabase.from('sessions').select('*').eq('coach_id', user.id)
    setPlayers(p || [])
    setSessions(s || [])
    setLoading(false)
    setRefreshing(false)
  }

  const addSession = async () => {
    if (!newSession.player_id || !newSession.price) return
    setSavingSession(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('sessions').insert({ coach_id: user.id, player_id: newSession.player_id, price: parseFloat(newSession.price), session_date: newSession.session_date, notes: newSession.notes, paid: true })
    setNewSession({ player_id: '', price: '', session_date: new Date().toISOString().split('T')[0], notes: '' })
    setShowAddSession(false)
    setSavingSession(false)
    fetchAll()
  }

  const addPlayer = async () => {
    if (!newPlayer.full_name) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('players').insert({ coach_id: user.id, full_name: newPlayer.full_name, current_handicap: parseFloat(newPlayer.current_handicap) || 0 })
    setNewPlayer({ full_name: '', current_handicap: '' })
    setShowAdd(false)
    setSaving(false)
    fetchAll()
  }

  const now = new Date()
  const colors = ['#1B5E35','#0891B2','#7C3AED','#DC2626','#D97706','#059669']

  if (loading) return <View style={s.loading}><ActivityIndicator color={G} size="large" /></View>

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>My players</Text>
          <Text style={s.sub}>{players.length} players</Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowAdd(true)}>
          <Text style={s.addBtnTxt}>+ Player</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll() }} tintColor={G} />}>
        {players.map((p, i) => {
          const ps = sessions.filter(s => s.player_id === p.id)
          const revenue = ps.reduce((sum, s) => sum + (s.price || 0), 0)
          const last = ps.sort((a, b) => new Date(b.session_date) - new Date(a.session_date))[0]
          const days = last ? Math.floor((now - new Date(last.session_date)) / (1000*60*60*24)) : null
          const inactive = !days || days > 14
          return (
            <TouchableOpacity key={p.id} style={[s.row, inactive && s.rowRed]} onPress={() => navigation.navigate("PlayerDetail", { player: p })}>
              <View style={[s.av, { backgroundColor: colors[i % colors.length] }]}>
                <Text style={s.avTxt}>{p.full_name?.charAt(0)}</Text>
              </View>
              <View style={s.info}>
                <Text style={s.name}>{p.full_name}</Text>
                <Text style={s.rowSub}>{ps.length} sessions</Text>
              </View>
              <View style={s.right}>
                <Text style={s.hcp}>{p.current_handicap}</Text>
                <Text style={s.hcpLabel}>HCP</Text>
              </View>
              <View style={s.right}>
                <Text style={s.rev}>{revenue}€</Text>
                <Text style={s.hcpLabel}>Revenue</Text>
              </View>
              <View style={[s.badge, inactive ? s.badgeRed : s.badgeGreen]}>
                <Text style={[s.badgeTxt, { color: inactive ? '#DC2626' : G }]}>{inactive ? 'Inactive' : 'Active'}</Text>
              </View>
            </TouchableOpacity>
          )
        })}
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Add a player</Text>
            <TouchableOpacity onPress={() => setShowAdd(false)}>
              <Text style={s.modalClose}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <View style={s.modalBody}>
            <Text style={s.label}>Full name</Text>
            <TextInput style={s.input} value={newPlayer.full_name} onChangeText={v => setNewPlayer({...newPlayer, full_name: v})} placeholder="Emma Wilson" placeholderTextColor="#9CA3AF" />
            <Text style={s.label}>Handicap</Text>
            <TextInput style={s.input} value={newPlayer.current_handicap} onChangeText={v => setNewPlayer({...newPlayer, current_handicap: v})} placeholder="8.2" keyboardType="decimal-pad" placeholderTextColor="#9CA3AF" />
            <TouchableOpacity style={[s.btn, saving && { opacity: 0.7 }]} onPress={addPlayer} disabled={saving}>
              <Text style={s.btnTxt}>{saving ? 'Adding...' : '+ Add player'}</Text>
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
  header: { backgroundColor: '#fff', padding: 20, paddingTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
  title: { fontSize: 24, fontWeight: '800', color: '#1a1a1a', letterSpacing: -0.5 },
  sub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  addBtn: { backgroundColor: G, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  addBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
  scroll: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#F8FAF8', marginHorizontal: 16, marginTop: 8, borderRadius: 12, borderWidth: 0.5, borderColor: '#E5E7EB' },
  rowRed: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  av: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  rowSub: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  right: { alignItems: 'center', minWidth: 45 },
  hcp: { fontSize: 16, fontWeight: '800', color: G },
  hcpLabel: { fontSize: 9, color: '#9CA3AF', fontWeight: '600' },
  rev: { fontSize: 13, fontWeight: '700', color: '#374151' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeGreen: { backgroundColor: '#E8F5EE' },
  badgeRed: { backgroundColor: '#FEF2F2' },
  badgeTxt: { fontSize: 10, fontWeight: '600' },
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  modalClose: { fontSize: 16, color: G, fontWeight: '600' },
  modalBody: { padding: 20 },
  label: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: '#F8FAF8', borderWidth: 1, borderColor: '#E0E5E0', borderRadius: 12, padding: 14, fontSize: 15, color: '#1a1a1a' },
  btn: { backgroundColor: G, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 24 },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  playerChip: { backgroundColor: '#F8FAF8', borderWidth: 1, borderColor: '#E0E5E0', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  playerChipActive: { backgroundColor: '#1B5E35', borderColor: '#1B5E35' },
  playerChipTxt: { fontSize: 13, color: '#1a1a1a', fontWeight: '500' },
})
