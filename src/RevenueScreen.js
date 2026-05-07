import { useState, useEffect } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity, Share, Alert, Modal, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from './supabase'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { colors } from './theme'
import { useCountUp } from './hooks/useCountUp'

export default function RevenueScreen({ navigation }) {
  const { t } = useTranslation()
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
  const animTotal = useCountUp(total, 1200)
  const animMonth = useCountUp(thisMonth, 1200)
  const animAvg = useCountUp(avg, 1200)

  if (loading) return <View style={s.loading}><ActivityIndicator color={colors.primary} size="large" /></View>

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>{t('revenue.title')}</Text>
          <Text style={s.sub}>{t('revenue.sessions_count', { count: sessions.length })}</Text>
        </View>
        <TouchableOpacity onPress={exportRevenue} style={s.btn2}>
          <Text style={s.btn2Txt}>↑ {t('revenue.export')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll() }} tintColor={colors.primary} />}>
        <View style={s.statsRow}>
          {[{label:t('revenue.total_revenue').toUpperCase(), value: animTotal+'€', sub: t('revenue.sessions_count', { count: sessions.length })}, {label:t('revenue.this_month').toUpperCase(), value: animMonth+'€'}, {label:t('revenue.avg_session').toUpperCase(), value: animAvg+'€'}].map((item, i) => (
            <View key={i} style={[s.stat, i === 0 && s.statGreen]}>
              <Text style={s.statLabel}>{item.label}</Text>
              <Text style={[s.statValue, i === 0 && { color: colors.primary }]}>{item.value}</Text>
            </View>
          ))}
        </View>
        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>{t('revenue.session_details')}</Text>
            <Text style={s.sectionSub}>{t('revenue.recorded', { count: sessions.length })}</Text>
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
                <View style={s.paidBadge}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}><Ionicons name="checkmark" size={12} color={colors.primary} /><Text style={s.paidTxt}>{t('revenue.paid')}</Text></View></View>
              </TouchableOpacity>
            )
          })}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={showAddSession} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={s.modalHead}>
            <Text style={s.modalTitle}>{t('sessions.add_session')}</Text>
            <TouchableOpacity onPress={() => setShowAddSession(false)}>
              <Text style={s.modalClose}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }}>
            <Text style={s.label}>{t('sessions.player')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {players.map(p => (
                <TouchableOpacity key={p.id} onPress={() => setNewSession({...newSession, player_id: p.id})} style={[s.chip, newSession.player_id === p.id && s.chipActive]}>
                  <Text style={[s.chipTxt, newSession.player_id === p.id && { color: colors.textInverse }]}>{p.full_name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={s.label}>{t('sessions.price')} (€)</Text>
            <TextInput style={s.input} value={newSession.price} onChangeText={v => setNewSession({...newSession, price: v})} placeholder="120" keyboardType="decimal-pad" placeholderTextColor={colors.textTertiary} />
            <Text style={s.label}>{t('sessions.date')}</Text>
            <TextInput style={s.input} value={newSession.session_date} onChangeText={v => setNewSession({...newSession, session_date: v})} placeholderTextColor={colors.textTertiary} />
            <TouchableOpacity style={[s.submitBtn, savingS && { opacity: 0.7 }]} onPress={addSession} disabled={savingS}>
              <Text style={s.submitTxt}>{savingS ? t('sessions.adding') : '+ ' + t('sessions.add_session')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={showAddPlayer} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={s.modalHead}>
            <Text style={s.modalTitle}>{t('players.add_player')}</Text>
            <TouchableOpacity onPress={() => setShowAddPlayer(false)}>
              <Text style={s.modalClose}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ padding: 20 }}>
            <Text style={s.label}>{t('players.full_name')}</Text>
            <TextInput style={s.input} value={newPlayerName} onChangeText={setNewPlayerName} placeholder="Emma Wilson" placeholderTextColor={colors.textTertiary} />
            <Text style={s.label}>{t('players.handicap')}</Text>
            <TextInput style={s.input} value={newPlayerHcp} onChangeText={setNewPlayerHcp} placeholder="8.2" keyboardType="decimal-pad" placeholderTextColor={colors.textTertiary} />
            <TouchableOpacity style={[s.submitBtn, savingP && { opacity: 0.7 }]} onPress={addPlayer} disabled={savingP}>
              <Text style={s.submitTxt}>{savingP ? t('players.adding') : '+ ' + t('players.add_player')}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surfaceElevated },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { backgroundColor: colors.surface, padding: 16, paddingTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 0.5, borderBottomColor: colors.borderStrong },
  title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
  sub: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  btn2: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  btn2Txt: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  scroll: { flex: 1 },
  statsRow: { padding: 16, gap: 10 },
  stat: { backgroundColor: colors.surface, borderRadius: 14, padding: 18, borderWidth: 0.5, borderColor: colors.borderStrong, marginBottom: 2 },
  statGreen: { borderTopWidth: 3, borderTopColor: colors.primary },
  statLabel: { fontSize: 10, color: colors.textTertiary, fontWeight: '600', marginBottom: 8 },
  statValue: { fontSize: 36, fontWeight: '800', color: colors.textPrimary, letterSpacing: -1 },
  section: { backgroundColor: colors.surface, borderRadius: 16, margin: 16, marginTop: 0, borderWidth: 0.5, borderColor: colors.borderStrong, overflow: 'hidden' },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  sectionSub: { fontSize: 12, color: colors.textTertiary },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 0.5, borderBottomColor: colors.surfaceElevated },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 13, fontWeight: '500', color: colors.textPrimary },
  rowDate: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  rowPrice: { fontSize: 15, fontWeight: '700', color: colors.primary, marginRight: 10 },
  paidBadge: { backgroundColor: colors.primaryLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  paidTxt: { fontSize: 10, fontWeight: '600', color: colors.primary },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 0.5, borderBottomColor: colors.borderStrong },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  modalClose: { fontSize: 16, color: colors.primary, fontWeight: '600' },
  label: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 12, padding: 14, fontSize: 15, color: colors.textPrimary },
  chip: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { fontSize: 13, color: colors.textPrimary, fontWeight: '500' },
  submitBtn: { backgroundColor: colors.primary, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 24, marginBottom: 40 },
  submitTxt: { color: colors.textInverse, fontSize: 16, fontWeight: '700' },
})
