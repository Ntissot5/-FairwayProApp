import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Modal, TextInput, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from './supabase'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
const G = '#1B5E35'

export default function SessionsScreen({ navigation }) {
  const { t } = useTranslation()
  const [players, setPlayers] = useState([])
  const [sessions, setSessions] = useState([])
  const [packages, setPackages] = useState([])
  const [playerPackages, setPlayerPackages] = useState([])
  const [selectedPackage, setSelectedPackage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState('sessions')
  const [showAddSession, setShowAddSession] = useState(false)
  const [showAddPackage, setShowAddPackage] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(null)
  const [editSession, setEditSession] = useState(null)
  const [editPrice, setEditPrice] = useState('')
  const [editDate, setEditDate] = useState('')
  const [newSession, setNewSession] = useState({ player_id: '', price: '', session_date: new Date().toISOString().split('T')[0], start_time: '09:00', notes: '' })
  const [newPkg, setNewPkg] = useState({ player_id: '', name: '', total_sessions: '10', price: '', payment_status: 'pending' })

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: p } = await supabase.from('players').select('*').eq('coach_id', user.id)
    const { data: s } = await supabase.from('sessions').select('*').eq('coach_id', user.id).order('session_date', { ascending: false })
    const { data: pk } = await supabase.from('packages').select('*, players(full_name)').eq('coach_id', user.id).order('created_at', { ascending: false })
    setPlayers(p || [])
    setSessions(s || [])
    setPackages(pk || [])
    setLoading(false)
    setRefreshing(false)
  }

  const updateSession = async () => {
    if (!editSession) return
    await supabase.from('sessions').update({ price: parseFloat(editPrice), session_date: editDate }).eq('id', editSession.id)
    setEditSession(null)
    fetchAll()
  }

  const fetchPlayerPackages = async (playerId) => {
    const { data } = await supabase.from('packages').select('*').eq('player_id', playerId).eq('payment_status', 'paid')
    const active = (data || []).filter(p => p.used_sessions < p.total_sessions)
    setPlayerPackages(active)
    setSelectedPackage(active.length > 0 ? active[0] : null)
  }

  const addSession = async () => {
    if (!newSession.player_id || !newSession.price) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('sessions').insert({ coach_id: user.id, player_id: newSession.player_id, price: parseFloat(newSession.price), session_date: newSession.session_date, notes: newSession.notes, paid: true })
    // Add to calendar
    if (newSession.start_time) {
      await supabase.from('lessons').insert({ coach_id: user.id, player_id: newSession.player_id, lesson_date: newSession.session_date, start_time: newSession.start_time + ':00', end_time: newSession.start_time + ':00', duration_minutes: 60, is_group: false, event_type: 'private', price: parseFloat(newSession.price) })
    }
    // If package selected, increment used_sessions
    if (selectedPackage) {
      await supabase.from('packages').update({ used_sessions: selectedPackage.used_sessions + 1 }).eq('id', selectedPackage.id)
    }
    setNewSession({ player_id: '', price: '', session_date: new Date().toISOString().split('T')[0], notes: '' })
    setSelectedPackage(null)
    setPlayerPackages([])
    setShowAddSession(false)
    setSaving(false)
    fetchAll()
  }

  const deleteSession = async (id) => {
    await supabase.from('sessions').delete().eq('id', id)
    fetchAll()
  }

  const generateAIPlan = async (session) => {
    const player = players.find(p => p.id === session.player_id)
    if (!player) return
    setGenerating(session.id)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const response = await fetch('https://aqdifzgqfemfdcigxsgw.supabase.co/functions/v1/claude-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 500, messages: [{ role: 'user', content: 'Generate 3 golf training exercises. Return ONLY a JSON array, no other text: [{"title":"...","description":"..."}] Player: ' + player.full_name + ', HCP: ' + player.current_handicap + ', Session notes: ' + (session.notes || 'General') }] })
      })
      const data = await response.json()
      const text = data.content?.[0]?.text || '[]'
      const clean = text.replace(/```json|```/g, '').trim()
      const exercises = JSON.parse(clean)
      for (const ex of exercises) {
        await supabase.from('exercises').insert({ player_id: player.id, coach_id: user.id, title: ex.title, description: ex.description, completed: false })
      }
      Alert.alert(t('sessions.plan_generated'), t('sessions.plan_generated_desc', { name: player.full_name }))
    } catch(e) { Alert.alert('Erreur', e.message) }
    setGenerating(null)
  }

  const addPackage = async () => {
    if (!newPkg.player_id || !newPkg.price) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const player = players.find(p => p.id === newPkg.player_id)
    await supabase.from('packages').insert({ coach_id: user.id, player_id: newPkg.player_id, name: newPkg.name || parseInt(newPkg.total_sessions) + ' séances — ' + player?.full_name, total_sessions: parseInt(newPkg.total_sessions), used_sessions: 0, price: parseFloat(newPkg.price), payment_status: newPkg.payment_status })
    setNewPkg({ player_id: '', name: '', total_sessions: '10', price: '', payment_status: 'pending' })
    setShowAddPackage(false)
    setSaving(false)
    fetchAll()
  }

  const incrementPackage = async (pkg) => {
    if (pkg.used_sessions >= pkg.total_sessions) return
    const today = new Date().toISOString().split('T')[0]
    Alert.prompt(
      '+ 1 séance',
      'Date de la séance (YYYY-MM-DD)',
      async (date) => {
        if (!date) return
        const sessionDate = date.trim() || today
        const { data: { user } } = await supabase.auth.getUser()
        // Create session
        await supabase.from('sessions').insert({
          coach_id: user.id,
          player_id: pkg.player_id,
          price: Math.round((pkg.price || 0) / pkg.total_sessions),
          session_date: sessionDate,
          notes: 'Package: ' + pkg.name,
          paid: true
        })
        // Create lesson in calendar
        await supabase.from('lessons').insert({
          coach_id: user.id,
          player_id: pkg.player_id,
          lesson_date: sessionDate,
          start_time: '10:00:00',
          end_time: '11:00:00',
          duration_minutes: 60,
          is_group: false,
          event_type: 'private',
          title: 'Package: ' + pkg.name,
          price: Math.round((pkg.price || 0) / pkg.total_sessions)
        })
        // Increment package
        await supabase.from('packages').update({ used_sessions: pkg.used_sessions + 1 }).eq('id', pkg.id)
        fetchAll()
      },
      'plain-text',
      today
    )
  }

  const markPaid = async (pkg) => {
    const { data: { user } } = await supabase.auth.getUser()
    // Mark package as paid
    await supabase.from('packages').update({ payment_status: 'paid' }).eq('id', pkg.id)
    // Create a revenue session for the full package price
    await supabase.from('sessions').insert({
      coach_id: user.id,
      player_id: pkg.player_id,
      price: pkg.price || 0,
      session_date: new Date().toISOString().split('T')[0],
      notes: 'Paiement package: ' + pkg.name,
      paid: true
    })
    fetchAll()
  }

  if (loading) return <View style={s.loading}><ActivityIndicator color={G} size="large" /></View>

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>{t('sessions.title')}</Text>
          <Text style={s.sub}>{t('sessions.summary', { sessions: sessions.length, packages: packages.length })}</Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={() => tab === 'sessions' ? setShowAddSession(true) : setShowAddPackage(true)}>
          <Text style={s.addBtnTxt}>+</Text>
        </TouchableOpacity>
      </View>

      <View style={s.tabs}>
        <TouchableOpacity style={[s.tab, tab === 'sessions' && s.tabActive]} onPress={() => setTab('sessions')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name="flag-outline" size={14} color={tab === 'sessions' ? G : '#9CA3AF'} /><Text style={[s.tabTxt, tab === 'sessions' && s.tabTxtActive]}>{t('sessions.tab_sessions')}</Text></View>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab === 'packages' && s.tabActive]} onPress={() => setTab('packages')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name="cube-outline" size={14} color={tab === 'packages' ? G : '#9CA3AF'} /><Text style={[s.tabTxt, tab === 'packages' && s.tabTxtActive]}>{t('sessions.tab_packages')}</Text></View>
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll() }} tintColor={G} />}>
        
        {tab === 'sessions' && (
          <>
            {sessions.length === 0 ? (
              <Text style={s.empty}>No sessions yet</Text>
            ) : sessions.map(session => {
              const player = players.find(p => p.id === session.player_id)
              return (
                <View key={session.id} style={s.card}>
                  <TouchableOpacity style={s.cardTop} onPress={() => player && navigation.navigate('PlayerDetail', { player })}>
                    <View style={s.av}>
                      <Text style={s.avTxt}>{player?.full_name?.charAt(0) || '?'}</Text>
                    </View>
                    <View style={s.info}>
                      <Text style={s.name}>{player?.full_name || 'Unknown'}</Text>
                      <Text style={s.date}>{session.session_date}</Text>
                    </View>
                    <Text style={s.price}>{session.price}€</Text>
                    <TouchableOpacity onPress={() => { setEditSession(session); setEditPrice(String(session.price)); setEditDate(session.session_date) }} style={{ backgroundColor: '#F8FAF8', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginRight: 6, borderWidth: 0.5, borderColor: '#E5E7EB' }}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: '#6B7280' }}>{t('common.edit')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteSession(session.id)} style={s.delBtn}>
                      <Text style={s.delTxt}>✕</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                  {session.notes ? <Text style={s.notes}>{session.notes}</Text> : null}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <TouchableOpacity onPress={() => generateAIPlan(session)} disabled={generating === session.id} style={[s.aiBtn, generating === session.id && { backgroundColor: '#E8F5EE' }]}>
                      <Text style={[s.aiBtnTxt, generating === session.id && { color: G }]}>{generating === session.id ? '...' : '✦ ' + t('sessions.generate_ai_plan')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )
            })}
          </>
        )}

        {tab === 'packages' && (
          <>
            {packages.length === 0 ? (
              <Text style={s.empty}>No packages yet</Text>
            ) : packages.map(pkg => {
              const pct = Math.round((pkg.used_sessions / pkg.total_sessions) * 100)
              const remaining = pkg.total_sessions - pkg.used_sessions
              const isAlmostDone = remaining <= 2
              return (
                <View key={pkg.id} style={[s.card, isAlmostDone && { borderColor: '#FECACA', borderWidth: 1 }]}>
                  <View style={s.cardTop}>
                    <View style={s.av}>
                      <Text style={s.avTxt}>{pkg.players?.full_name?.charAt(0) || '?'}</Text>
                    </View>
                    <View style={s.info}>
                      <Text style={s.name}>{pkg.name}</Text>
                      <Text style={s.date}>{pkg.players?.full_name}</Text>
                    </View>
                    <Text style={s.price}>{pkg.price}€</Text>
                  </View>
                  <View style={{ marginTop: 10 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: isAlmostDone ? '#DC2626' : '#374151' }}>{pkg.used_sessions}/{pkg.total_sessions} séances</Text>
                      <Text style={{ fontSize: 11, color: isAlmostDone ? '#DC2626' : '#9CA3AF' }}>{t('sessions.remaining', { count: remaining })}</Text>
                    </View>
                    <View style={{ height: 6, backgroundColor: '#F0F4F0', borderRadius: 3 }}>
                      <View style={{ height: 6, width: pct + '%', backgroundColor: isAlmostDone ? '#EF4444' : G, borderRadius: 3 }} />
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <TouchableOpacity onPress={() => incrementPackage(pkg)} style={[s.aiBtn, { flex: 1, alignItems: 'center' }]}>
                      <Text style={s.aiBtnTxt}>+ 1 séance</Text>
                    </TouchableOpacity>
                    {pkg.payment_status !== 'paid' ? (
                      <TouchableOpacity onPress={() => markPaid(pkg)} style={{ backgroundColor: '#E8F5EE', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }}>
                        <Text style={{ color: G, fontSize: 12, fontWeight: '600' }}>{t('sessions.paid')}</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={{ backgroundColor: '#E8F5EE', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }}>
                        <Text style={{ color: G, fontSize: 12, fontWeight: '600' }}>✅ Payé</Text>
                      </View>
                    )}
                  </View>
                </View>
              )
            })}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Edit Session Modal */}
      <Modal visible={!!editSession} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{t('sessions.edit')}</Text>
            <TouchableOpacity onPress={() => setEditSession(null)}>
              <Text style={s.modalClose}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
          <View style={s.modalBody}>
            <Text style={s.label}>{t('sessions.price')} (€)</Text>
            <TextInput style={s.input} value={editPrice} onChangeText={setEditPrice} keyboardType="decimal-pad" placeholderTextColor="#9CA3AF" />
            <Text style={s.label}>Date</Text>
            <TextInput style={s.input} value={editDate} onChangeText={setEditDate} placeholderTextColor="#9CA3AF" />
            <TouchableOpacity style={[s.btn, { marginTop: 24 }]} onPress={updateSession}>
              <Text style={s.btnTxt}>{t('common.save')}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Add Session Modal */}
      <Modal visible={showAddSession} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{t('sessions.add_session')}</Text>
            <TouchableOpacity onPress={() => setShowAddSession(false)}>
              <Text style={s.modalClose}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={s.modalBody}>
            <Text style={s.label}>{t('sessions.player')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {players.map(p => (
                <TouchableOpacity key={p.id} onPress={() => { setNewSession({...newSession, player_id: p.id}); fetchPlayerPackages(p.id) }} style={[s.chip, newSession.player_id === p.id && s.chipActive]}>
                  <Text style={[s.chipTxt, newSession.player_id === p.id && { color: '#fff' }]}>{p.full_name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {playerPackages.length > 0 && (
              <View style={{ marginTop: 14 }}>
                <Text style={s.label}>PACKAGE (optionnel)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <TouchableOpacity onPress={() => setSelectedPackage(null)} style={[s.chip, !selectedPackage && s.chipActive]}>
                    <Text style={[s.chipTxt, !selectedPackage && { color: '#fff' }]}>Sans package</Text>
                  </TouchableOpacity>
                  {playerPackages.map(pkg => (
                    <TouchableOpacity key={pkg.id} onPress={() => { setSelectedPackage(pkg); setNewSession(prev => ({...prev, price: pkg.price ? Math.round(pkg.price / pkg.total_sessions) : prev.price})) }} style={[s.chip, selectedPackage?.id === pkg.id && s.chipActive]}>
                      <Text style={[s.chipTxt, selectedPackage?.id === pkg.id && { color: '#fff' }]}>{pkg.name} ({pkg.used_sessions}/{pkg.total_sessions})</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            <Text style={s.label}>{t('sessions.price')} (€)</Text>
            <TextInput style={s.input} value={newSession.price} onChangeText={v => setNewSession({...newSession, price: v})} placeholder="120" keyboardType="decimal-pad" placeholderTextColor="#9CA3AF" />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1.5 }}>
                <Text style={s.label}>Date</Text>
                <TextInput style={s.input} value={newSession.session_date} onChangeText={v => setNewSession({...newSession, session_date: v})} placeholder="2026-03-22" placeholderTextColor="#9CA3AF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Heure</Text>
                <TextInput style={s.input} value={newSession.start_time} onChangeText={v => setNewSession({...newSession, start_time: v})} placeholder="09:00" placeholderTextColor="#9CA3AF" />
              </View>
            </View>
            <Text style={s.label}>{t('sessions.notes')}</Text>
            <TextInput style={[s.input, { height: 80 }]} value={newSession.notes} onChangeText={v => setNewSession({...newSession, notes: v})} placeholder="Putting, drive..." placeholderTextColor="#9CA3AF" multiline />
            <TouchableOpacity style={[s.btn, saving && { opacity: 0.7 }]} onPress={addSession} disabled={saving}>
              <Text style={s.btnTxt}>{saving ? t('sessions.adding') : '+ ' + t('sessions.add_session')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Add Package Modal */}
      <Modal visible={showAddPackage} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Nouveau package</Text>
            <TouchableOpacity onPress={() => setShowAddPackage(false)}>
              <Text style={s.modalClose}>Annuler</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={s.modalBody}>
            <Text style={s.label}>Élève</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {players.map(p => (
                <TouchableOpacity key={p.id} onPress={() => setNewPkg({...newPkg, player_id: p.id})} style={[s.chip, newPkg.player_id === p.id && s.chipActive]}>
                  <Text style={[s.chipTxt, newPkg.player_id === p.id && { color: '#fff' }]}>{p.full_name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={s.label}>Nom (optionnel)</Text>
            <TextInput style={s.input} value={newPkg.name} onChangeText={v => setNewPkg({...newPkg, name: v})} placeholder="Ex: Formule été" placeholderTextColor="#9CA3AF" />
            <Text style={s.label}>Nombre de séances</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {['5','8','10','12','15','20'].map(n => (
                <TouchableOpacity key={n} onPress={() => setNewPkg({...newPkg, total_sessions: n})} style={[s.chip, newPkg.total_sessions === n && s.chipActive]}>
                  <Text style={[s.chipTxt, newPkg.total_sessions === n && { color: '#fff' }]}>{n} séances</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={s.label}>Prix total (€)</Text>
            <TextInput style={s.input} value={newPkg.price} onChangeText={v => setNewPkg({...newPkg, price: v})} placeholder="1000" keyboardType="decimal-pad" placeholderTextColor="#9CA3AF" />
            {newPkg.price && newPkg.total_sessions ? (
              <Text style={{ fontSize: 12, color: G, marginTop: 6, fontWeight: '600' }}>{Math.round(parseFloat(newPkg.price) / parseInt(newPkg.total_sessions))}€ / séance</Text>
            ) : null}
            <Text style={s.label}>Paiement</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[['pending', t('revenue.unpaid')],['paid', t('sessions.paid')]].map(([val, label]) => (
                <TouchableOpacity key={val} onPress={() => setNewPkg({...newPkg, payment_status: val})} style={[s.chip, newPkg.payment_status === val && s.chipActive]}>
                  <Text style={[s.chipTxt, newPkg.payment_status === val && { color: '#fff' }]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[s.btn, saving && { opacity: 0.7 }]} onPress={addPackage} disabled={saving}>
              <Text style={s.btnTxt}>{saving ? 'Creating...' : '+ Créer le package'}</Text>
            </TouchableOpacity>
          </ScrollView>
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
  addBtn: { backgroundColor: G, borderRadius: 20, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  addBtnTxt: { color: '#fff', fontSize: 22, fontWeight: '400', marginTop: -2 },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', padding: 4, margin: 16, marginBottom: 8, borderRadius: 12, borderWidth: 0.5, borderColor: '#E5E7EB' },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: G },
  tabTxt: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  tabTxtActive: { color: '#fff' },
  scroll: { flex: 1 },
  empty: { textAlign: 'center', color: '#9CA3AF', fontSize: 13, padding: 40 },
  card: { backgroundColor: '#fff', borderRadius: 12, margin: 16, marginBottom: 8, padding: 14, borderWidth: 0.5, borderColor: '#E5E7EB' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  av: { width: 36, height: 36, borderRadius: 18, backgroundColor: G, alignItems: 'center', justifyContent: 'center' },
  avTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  date: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  price: { fontSize: 16, fontWeight: '800', color: G },
  delBtn: { padding: 4 },
  delTxt: { fontSize: 16, color: '#DC2626' },
  notes: { fontSize: 12, color: '#6B7280', marginTop: 8, fontStyle: 'italic' },
  aiBtn: { backgroundColor: G, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  aiBtnTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  modalClose: { fontSize: 16, color: G, fontWeight: '600' },
  modalBody: { padding: 20 },
  label: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: '#F8FAF8', borderWidth: 1, borderColor: '#E0E5E0', borderRadius: 12, padding: 14, fontSize: 15, color: '#1a1a1a' },
  chip: { backgroundColor: '#F8FAF8', borderWidth: 1, borderColor: '#E0E5E0', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  chipActive: { backgroundColor: G, borderColor: G },
  chipTxt: { fontSize: 13, color: '#1a1a1a', fontWeight: '500' },
  btn: { backgroundColor: G, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 24, marginBottom: 40 },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
