import { useState, useEffect, useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Modal, TextInput, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { supabase } from './supabase'
import { useTheme } from './ThemeContext'
import { useTranslation } from 'react-i18next'
import AnimatedPressable from './components/AnimatedPressable'
import AnimatedListItem from './components/AnimatedListItem'
import { CardListSkeleton } from './components/Skeleton'

export default function SessionsScreen({ navigation }) {
  const { colors, isDark } = useTheme()
  const { t } = useTranslation()
  const s = useMemo(() => makeStyles(colors), [colors])

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
    const { data: ss } = await supabase.from('sessions').select('*').eq('coach_id', user.id).order('session_date', { ascending: false })
    const { data: pk } = await supabase.from('packages').select('*, players(full_name)').eq('coach_id', user.id).order('created_at', { ascending: false })
    setPlayers(p || [])
    setSessions(ss || [])
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
    if (newSession.start_time) {
      await supabase.from('lessons').insert({ coach_id: user.id, player_id: newSession.player_id, lesson_date: newSession.session_date, start_time: newSession.start_time + ':00', end_time: newSession.start_time + ':00', duration_minutes: 60, is_group: false, event_type: 'private', price: parseFloat(newSession.price) })
    }
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
      const exs = JSON.parse(clean)
      for (const ex of exs) {
        await supabase.from('exercises').insert({ player_id: player.id, coach_id: user.id, title: ex.title, description: ex.description, completed: false })
      }
      Alert.alert(t('sessions.planGenerated'), t('sessions.exercisesAdded', { name: player.full_name }))
    } catch(e) { Alert.alert(t('common.error'), e.message) }
    setGenerating(null)
  }

  const addPackage = async () => {
    if (!newPkg.player_id || !newPkg.price) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const player = players.find(p => p.id === newPkg.player_id)
    await supabase.from('packages').insert({ coach_id: user.id, player_id: newPkg.player_id, name: newPkg.name || parseInt(newPkg.total_sessions) + ' seances \u2014 ' + player?.full_name, total_sessions: parseInt(newPkg.total_sessions), used_sessions: 0, price: parseFloat(newPkg.price), payment_status: newPkg.payment_status })
    setNewPkg({ player_id: '', name: '', total_sessions: '10', price: '', payment_status: 'pending' })
    setShowAddPackage(false)
    setSaving(false)
    fetchAll()
  }

  const incrementPackage = async (pkg) => {
    if (pkg.used_sessions >= pkg.total_sessions) return
    const today = new Date().toISOString().split('T')[0]
    Alert.prompt(
      '+ 1 seance',
      'Date de la seance (YYYY-MM-DD)',
      async (date) => {
        if (!date) return
        const sessionDate = date.trim() || today
        const { data: { user } } = await supabase.auth.getUser()
        await supabase.from('sessions').insert({
          coach_id: user.id,
          player_id: pkg.player_id,
          price: Math.round((pkg.price || 0) / pkg.total_sessions),
          session_date: sessionDate,
          notes: 'Package: ' + pkg.name,
          paid: true
        })
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
        await supabase.from('packages').update({ used_sessions: pkg.used_sessions + 1 }).eq('id', pkg.id)
        fetchAll()
      },
      'plain-text',
      today
    )
  }

  const markPaid = async (pkg) => {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('packages').update({ payment_status: 'paid' }).eq('id', pkg.id)
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

  if (loading) return (
    <View style={s.loading}>
      <CardListSkeleton />
    </View>
  )

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>{t('sessions.title')}</Text>
          <Text style={s.sub}>{sessions.length} {t('common.sessions')} \u00B7 {packages.length} {t('sessions.packages')}</Text>
        </View>
        <AnimatedPressable style={s.addBtn} onPress={() => tab === 'sessions' ? setShowAddSession(true) : setShowAddPackage(true)}>
          <Text style={s.addBtnTxt}>+</Text>
        </AnimatedPressable>
      </View>

      <View style={s.tabs}>
        <TouchableOpacity style={[s.tab, tab === 'sessions' && s.tabActive]} onPress={() => setTab('sessions')}>
          <MaterialCommunityIcons name="golf" size={14} color={tab === 'sessions' ? '#fff' : colors.textTertiary} />
          <Text style={[s.tabTxt, tab === 'sessions' && s.tabTxtActive]}> {t('sessions.title')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab === 'packages' && s.tabActive]} onPress={() => setTab('packages')}>
          <Ionicons name="cube-outline" size={14} color={tab === 'packages' ? '#fff' : colors.textTertiary} />
          <Text style={[s.tabTxt, tab === 'packages' && s.tabTxtActive]}> {t('sessions.packages')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll() }} tintColor={colors.primary} />}>

        {tab === 'sessions' && (
          <>
            {sessions.length === 0 ? (
              <Text style={s.empty}>{t('sessions.noSessions')}</Text>
            ) : sessions.map((session, idx) => {
              const player = players.find(p => p.id === session.player_id)
              return (
                <AnimatedListItem key={session.id} index={idx}>
                  <View style={s.card}>
                    <TouchableOpacity style={s.cardTop} onPress={() => player && navigation.navigate('PlayerDetail', { player })}>
                      <View style={s.av}>
                        <Text style={s.avTxt}>{player?.full_name?.charAt(0) || '?'}</Text>
                      </View>
                      <View style={s.info}>
                        <Text style={s.name}>{player?.full_name || 'Unknown'}</Text>
                        <Text style={s.date}>{session.session_date}</Text>
                      </View>
                      <Text style={s.price}>{session.price}\u20AC</Text>
                      <TouchableOpacity onPress={() => { setEditSession(session); setEditPrice(String(session.price)); setEditDate(session.session_date) }} style={{ backgroundColor: colors.inputBg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginRight: 6, borderWidth: 0.5, borderColor: colors.separator }}>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textTertiary }}>{t('common.edit')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => deleteSession(session.id)} style={s.delBtn}>
                        <Ionicons name="close" size={16} color={colors.destructive} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                    {session.notes ? <Text style={s.notes}>{session.notes}</Text> : null}
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                      <AnimatedPressable onPress={() => generateAIPlan(session)} disabled={generating === session.id} style={[s.aiBtn, generating === session.id && { backgroundColor: colors.primaryLight }]}>
                        <Text style={[s.aiBtnTxt, generating === session.id && { color: colors.primary }]}>{generating === session.id ? '...' : '\u2726 ' + t('sessions.generatePlan')}</Text>
                      </AnimatedPressable>
                    </View>
                  </View>
                </AnimatedListItem>
              )
            })}
          </>
        )}

        {tab === 'packages' && (
          <>
            {packages.length === 0 ? (
              <Text style={s.empty}>{t('sessions.noPackages')}</Text>
            ) : packages.map((pkg, idx) => {
              const pct = Math.round((pkg.used_sessions / pkg.total_sessions) * 100)
              const remaining = pkg.total_sessions - pkg.used_sessions
              const isAlmostDone = remaining <= 2
              return (
                <AnimatedListItem key={pkg.id} index={idx}>
                  <View style={[s.card, isAlmostDone && { borderColor: colors.destructive, borderWidth: 1 }]}>
                    <View style={s.cardTop}>
                      <View style={s.av}>
                        <Text style={s.avTxt}>{pkg.players?.full_name?.charAt(0) || '?'}</Text>
                      </View>
                      <View style={s.info}>
                        <Text style={s.name}>{pkg.name}</Text>
                        <Text style={s.date}>{pkg.players?.full_name}</Text>
                      </View>
                      <Text style={s.price}>{pkg.price}\u20AC</Text>
                    </View>
                    <View style={{ marginTop: 10 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: isAlmostDone ? colors.destructive : colors.textSecondary }}>{pkg.used_sessions}/{pkg.total_sessions} seances</Text>
                        <Text style={{ fontSize: 11, color: isAlmostDone ? colors.destructive : colors.textTertiary }}>{remaining} restante{remaining > 1 ? 's' : ''}{isAlmostDone ? ' !' : ''}</Text>
                      </View>
                      <View style={{ height: 6, backgroundColor: colors.separatorLight, borderRadius: 3 }}>
                        <View style={{ height: 6, width: pct + '%', backgroundColor: isAlmostDone ? colors.destructive : colors.primary, borderRadius: 3 }} />
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                      <AnimatedPressable onPress={() => incrementPackage(pkg)} style={[s.aiBtn, { flex: 1, alignItems: 'center' }]}>
                        <Text style={s.aiBtnTxt}>+ 1 seance</Text>
                      </AnimatedPressable>
                      {pkg.payment_status !== 'paid' ? (
                        <AnimatedPressable onPress={() => markPaid(pkg)} style={{ backgroundColor: colors.primaryLight, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }}>
                          <Ionicons name="checkmark" size={14} color={colors.primary} />
                          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}> Paye</Text>
                        </AnimatedPressable>
                      ) : (
                        <View style={{ backgroundColor: colors.primaryLight, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}> Paye</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </AnimatedListItem>
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
            <Text style={s.modalTitle}>{t('sessions.editSession')}</Text>
            <TouchableOpacity onPress={() => setEditSession(null)}>
              <Text style={s.modalClose}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
          <View style={s.modalBody}>
            <Text style={s.label}>{t('sessions.price')}</Text>
            <TextInput style={s.input} value={editPrice} onChangeText={setEditPrice} keyboardType="decimal-pad" placeholderTextColor={colors.textTertiary} />
            <Text style={s.label}>{t('sessions.date')}</Text>
            <TextInput style={s.input} value={editDate} onChangeText={setEditDate} placeholderTextColor={colors.textTertiary} />
            <AnimatedPressable style={[s.btn, { marginTop: 24 }]} onPress={updateSession}>
              <Text style={s.btnTxt}>{t('common.save')}</Text>
            </AnimatedPressable>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Add Session Modal */}
      <Modal visible={showAddSession} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{t('sessions.addSession')}</Text>
            <TouchableOpacity onPress={() => setShowAddSession(false)}>
              <Text style={s.modalClose}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={s.modalBody}>
            <Text style={s.label}>{t('common.player')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {players.map(p => (
                <TouchableOpacity key={p.id} onPress={() => { setNewSession({...newSession, player_id: p.id}); fetchPlayerPackages(p.id) }} style={[s.chip, newSession.player_id === p.id && s.chipActive]}>
                  <Text style={[s.chipTxt, newSession.player_id === p.id && { color: '#fff' }]}>{p.full_name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {playerPackages.length > 0 && (
              <View style={{ marginTop: 14 }}>
                <Text style={s.label}>{t('sessions.packageOptional')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <TouchableOpacity onPress={() => setSelectedPackage(null)} style={[s.chip, !selectedPackage && s.chipActive]}>
                    <Text style={[s.chipTxt, !selectedPackage && { color: '#fff' }]}>{t('sessions.withoutPackage')}</Text>
                  </TouchableOpacity>
                  {playerPackages.map(pkg => (
                    <TouchableOpacity key={pkg.id} onPress={() => { setSelectedPackage(pkg); setNewSession(prev => ({...prev, price: pkg.price ? Math.round(pkg.price / pkg.total_sessions) : prev.price})) }} style={[s.chip, selectedPackage?.id === pkg.id && s.chipActive]}>
                      <Text style={[s.chipTxt, selectedPackage?.id === pkg.id && { color: '#fff' }]}>{pkg.name} ({pkg.used_sessions}/{pkg.total_sessions})</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            <Text style={s.label}>{t('sessions.price')}</Text>
            <TextInput style={s.input} value={newSession.price} onChangeText={v => setNewSession({...newSession, price: v})} placeholder="120" keyboardType="decimal-pad" placeholderTextColor={colors.textTertiary} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1.5 }}>
                <Text style={s.label}>{t('sessions.date')}</Text>
                <TextInput style={s.input} value={newSession.session_date} onChangeText={v => setNewSession({...newSession, session_date: v})} placeholder="2026-03-22" placeholderTextColor={colors.textTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>{t('sessions.hour')}</Text>
                <TextInput style={s.input} value={newSession.start_time} onChangeText={v => setNewSession({...newSession, start_time: v})} placeholder="09:00" placeholderTextColor={colors.textTertiary} />
              </View>
            </View>
            <Text style={s.label}>{t('sessions.notes')}</Text>
            <TextInput style={[s.input, { height: 80 }]} value={newSession.notes} onChangeText={v => setNewSession({...newSession, notes: v})} placeholder={t('sessions.notesPlaceholder')} placeholderTextColor={colors.textTertiary} multiline />
            <AnimatedPressable style={[s.btn, saving && { opacity: 0.7 }]} onPress={addSession} disabled={saving}>
              <Text style={s.btnTxt}>{saving ? t('sessions.adding') : t('sessions.addBtn')}</Text>
            </AnimatedPressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Add Package Modal */}
      <Modal visible={showAddPackage} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{t('sessions.newPackage')}</Text>
            <TouchableOpacity onPress={() => setShowAddPackage(false)}>
              <Text style={s.modalClose}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={s.modalBody}>
            <Text style={s.label}>{t('booking.student')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {players.map(p => (
                <TouchableOpacity key={p.id} onPress={() => setNewPkg({...newPkg, player_id: p.id})} style={[s.chip, newPkg.player_id === p.id && s.chipActive]}>
                  <Text style={[s.chipTxt, newPkg.player_id === p.id && { color: '#fff' }]}>{p.full_name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={s.label}>{t('sessions.packageName')}</Text>
            <TextInput style={s.input} value={newPkg.name} onChangeText={v => setNewPkg({...newPkg, name: v})} placeholder={t('sessions.packagePlaceholder')} placeholderTextColor={colors.textTertiary} />
            <Text style={s.label}>{t('sessions.nbSessions')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {['5','8','10','12','15','20'].map(n => (
                <TouchableOpacity key={n} onPress={() => setNewPkg({...newPkg, total_sessions: n})} style={[s.chip, newPkg.total_sessions === n && s.chipActive]}>
                  <Text style={[s.chipTxt, newPkg.total_sessions === n && { color: '#fff' }]}>{n} seances</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={s.label}>{t('sessions.totalPrice')}</Text>
            <TextInput style={s.input} value={newPkg.price} onChangeText={v => setNewPkg({...newPkg, price: v})} placeholder="1000" keyboardType="decimal-pad" placeholderTextColor={colors.textTertiary} />
            {newPkg.price && newPkg.total_sessions ? (
              <Text style={{ fontSize: 12, color: colors.primary, marginTop: 6, fontWeight: '600' }}>{Math.round(parseFloat(newPkg.price) / parseInt(newPkg.total_sessions))}{t('sessions.perSession')}</Text>
            ) : null}
            <Text style={s.label}>{t('sessions.payment')}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[['pending',t('sessions.pending')],['paid',t('sessions.paid')]].map(([val, label]) => (
                <TouchableOpacity key={val} onPress={() => setNewPkg({...newPkg, payment_status: val})} style={[s.chip, newPkg.payment_status === val && s.chipActive]}>
                  <Text style={[s.chipTxt, newPkg.payment_status === val && { color: '#fff' }]}>
                    {val === 'paid' && <Ionicons name="checkmark-circle" size={12} color={newPkg.payment_status === val ? '#fff' : colors.textTertiary} />}
                    {val === 'pending' && <Ionicons name="card-outline" size={12} color={newPkg.payment_status === val ? '#fff' : colors.textTertiary} />}
                    {' '}{label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <AnimatedPressable style={[s.btn, saving && { opacity: 0.7 }]} onPress={addPackage} disabled={saving}>
              <Text style={s.btnTxt}>{saving ? t('sessions.creating') : t('sessions.createPackage')}</Text>
            </AnimatedPressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bgSecondary },
  loading: { flex: 1, backgroundColor: c.bgSecondary },
  header: { backgroundColor: c.card, padding: 20, paddingTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 0.5, borderBottomColor: c.separator },
  title: { fontSize: 24, fontWeight: '800', color: c.text, letterSpacing: -0.5 },
  sub: { fontSize: 12, color: c.textTertiary, marginTop: 2 },
  addBtn: { backgroundColor: c.primary, borderRadius: 20, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  addBtnTxt: { color: '#fff', fontSize: 22, fontWeight: '400', marginTop: -2 },
  tabs: { flexDirection: 'row', backgroundColor: c.card, padding: 4, margin: 16, marginBottom: 8, borderRadius: 12, borderWidth: 0.5, borderColor: c.separator },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10, flexDirection: 'row', justifyContent: 'center' },
  tabActive: { backgroundColor: c.primary },
  tabTxt: { fontSize: 13, fontWeight: '600', color: c.textTertiary },
  tabTxtActive: { color: '#fff' },
  scroll: { flex: 1 },
  empty: { textAlign: 'center', color: c.textTertiary, fontSize: 13, padding: 40 },
  card: { backgroundColor: c.card, borderRadius: 12, margin: 16, marginBottom: 8, padding: 14, borderWidth: 0.5, borderColor: c.separator },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  av: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  avTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600', color: c.text },
  date: { fontSize: 11, color: c.textTertiary, marginTop: 2 },
  price: { fontSize: 16, fontWeight: '800', color: c.primary },
  delBtn: { padding: 4 },
  notes: { fontSize: 12, color: c.textTertiary, marginTop: 8, fontStyle: 'italic' },
  aiBtn: { backgroundColor: c.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  aiBtnTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
  modal: { flex: 1, backgroundColor: c.card },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 0.5, borderBottomColor: c.separator },
  modalTitle: { fontSize: 18, fontWeight: '700', color: c.text },
  modalClose: { fontSize: 16, color: c.primary, fontWeight: '600' },
  modalBody: { padding: 20 },
  label: { fontSize: 12, fontWeight: '600', color: c.textTertiary, marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 12, padding: 14, fontSize: 15, color: c.text },
  chip: { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  chipActive: { backgroundColor: c.primary, borderColor: c.primary },
  chipTxt: { fontSize: 13, color: c.text, fontWeight: '500' },
  btn: { backgroundColor: c.primary, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 24, marginBottom: 40 },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
