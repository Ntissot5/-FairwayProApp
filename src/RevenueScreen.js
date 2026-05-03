import { useState, useEffect, useMemo } from 'react'
import { View, Text, ScrollView, StyleSheet, RefreshControl, Share, Alert, Modal, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from './supabase'
import { useTheme } from './ThemeContext'
import { useTranslation } from 'react-i18next'
import AnimatedPressable from './components/AnimatedPressable'
import AnimatedListItem from './components/AnimatedListItem'
import { DashboardSkeleton } from './components/Skeleton'

export default function RevenueScreen({ navigation }) {
  const { colors } = useTheme()
  const { t } = useTranslation()
  const s = useMemo(() => makeStyles(colors), [colors])
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
    lines.push(t('revenue.thisMonth') + ': ' + thisMonth + '€')
    lines.push(t('revenue.avgSession') + ': ' + avg + '€/session')
    lines.push('')
    lines.push(t('revenue.sessionDetails') + ':')
    lines.push('------------------------')
    sessions.forEach(s => {
      const player = players.find(p => p.id === s.player_id)
      lines.push(s.session_date + ' — ' + (player?.full_name || '—') + ' — ' + s.price + '€')
    })
    try { await Share.share({ message: lines.join('\n'), title: 'FairwayPro Revenue' }) } catch(e) { Alert.alert(t('common.error'), e.message) }
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

  if (loading) return <SafeAreaView style={s.safe}><View style={s.header}><View><Text style={s.title}>{t('revenue.title')}</Text></View></View><DashboardSkeleton /></SafeAreaView>

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>{t('revenue.title')}</Text>
          <Text style={s.sub}>{sessions.length} {t('common.sessions')}</Text>
        </View>
        <AnimatedPressable onPress={exportRevenue} style={s.btn2}>
          <Ionicons name="share-outline" size={16} color={colors.textSecondary} />
          <Text style={s.btn2Txt}>{t('revenue.export')}</Text>
        </AnimatedPressable>
      </View>

      <ScrollView style={s.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll() }} tintColor={colors.primary} />}>
        <View style={s.statsRow}>
          {[{label: t('revenue.totalRevenue'), value: total+'€', sub: sessions.length+' '+t('common.sessions')}, {label: t('revenue.thisMonth'), value: thisMonth+'€'}, {label: t('revenue.avgSession'), value: avg+'€'}].map((item, i) => (
            <View key={i} style={[s.stat, i === 0 && s.statGreen]}>
              <Text style={s.statLabel}>{item.label}</Text>
              <Text style={[s.statValue, i === 0 && { color: colors.primary }]}>{item.value}</Text>
            </View>
          ))}
        </View>
        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>{t('revenue.sessionDetails')}</Text>
            <Text style={s.sectionSub}>{sessions.length} {t('revenue.recorded')}</Text>
          </View>
          {sessions.map((session, i) => {
            const player = players.find(p => p.id === session.player_id)
            return (
              <AnimatedListItem key={session.id} index={i}>
                <AnimatedPressable style={s.row} onPress={() => player && navigation.navigate('PlayerDetail', { player })}>
                  <View style={s.rowInfo}>
                    <Text style={s.rowName}>{player?.full_name || '—'}</Text>
                    <Text style={s.rowDate}>{session.session_date}</Text>
                  </View>
                  <Text style={s.rowPrice}>{session.price}€</Text>
                  <View style={s.paidBadge}>
                    <Ionicons name="checkmark" size={10} color={colors.primary} />
                    <Text style={s.paidTxt}>{t('revenue.paid')}</Text>
                  </View>
                </AnimatedPressable>
              </AnimatedListItem>
            )
          })}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={showAddSession} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.card }}>
          <View style={s.modalHead}>
            <Text style={s.modalTitle}>{t('sessions.addSession')}</Text>
            <AnimatedPressable onPress={() => setShowAddSession(false)} haptic={false}><Text style={s.modalClose}>{t('common.cancel')}</Text></AnimatedPressable>
          </View>
          <ScrollView style={{ padding: 20 }}>
            <Text style={s.label}>{t('common.player')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {players.map(p => (
                <AnimatedPressable key={p.id} onPress={() => setNewSession({...newSession, player_id: p.id})} style={[s.chip, newSession.player_id === p.id && s.chipActive]}>
                  <Text style={[s.chipTxt, newSession.player_id === p.id && { color: '#fff' }]}>{p.full_name}</Text>
                </AnimatedPressable>
              ))}
            </ScrollView>
            <Text style={s.label}>{t('sessions.price')}</Text>
            <TextInput style={s.input} value={newSession.price} onChangeText={v => setNewSession({...newSession, price: v})} placeholder="120" keyboardType="decimal-pad" placeholderTextColor={colors.textTertiary} />
            <Text style={s.label}>{t('sessions.date')}</Text>
            <TextInput style={s.input} value={newSession.session_date} onChangeText={v => setNewSession({...newSession, session_date: v})} placeholderTextColor={colors.textTertiary} />
            <AnimatedPressable style={[s.submitBtn, savingS && { opacity: 0.7 }]} onPress={addSession} disabled={savingS} hapticStyle="medium">
              <Text style={s.submitTxt}>{savingS ? t('sessions.adding') : t('sessions.addBtn')}</Text>
            </AnimatedPressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={showAddPlayer} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.card }}>
          <View style={s.modalHead}>
            <Text style={s.modalTitle}>{t('players.addPlayer')}</Text>
            <AnimatedPressable onPress={() => setShowAddPlayer(false)} haptic={false}><Text style={s.modalClose}>{t('common.cancel')}</Text></AnimatedPressable>
          </View>
          <View style={{ padding: 20 }}>
            <Text style={s.label}>{t('players.fullName')}</Text>
            <TextInput style={s.input} value={newPlayerName} onChangeText={setNewPlayerName} placeholder="Emma Wilson" placeholderTextColor={colors.textTertiary} />
            <Text style={s.label}>{t('players.handicap')}</Text>
            <TextInput style={s.input} value={newPlayerHcp} onChangeText={setNewPlayerHcp} placeholder="8.2" keyboardType="decimal-pad" placeholderTextColor={colors.textTertiary} />
            <AnimatedPressable style={[s.submitBtn, savingP && { opacity: 0.7 }]} onPress={addPlayer} disabled={savingP} hapticStyle="medium">
              <Text style={s.submitTxt}>{savingP ? t('players.adding') : t('players.addBtn')}</Text>
            </AnimatedPressable>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bgSecondary },
  header: { backgroundColor: c.card, padding: 16, paddingTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 0.5, borderBottomColor: c.separator },
  title: { fontSize: 22, fontWeight: '800', color: c.text, letterSpacing: -0.5 },
  sub: { fontSize: 12, color: c.textTertiary, marginTop: 2 },
  btn2: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.separator, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  btn2Txt: { fontSize: 11, fontWeight: '600', color: c.textSecondary },
  scroll: { flex: 1 },
  statsRow: { padding: 16, gap: 10 },
  stat: { backgroundColor: c.card, borderRadius: 14, padding: 18, borderWidth: 0.5, borderColor: c.separator, marginBottom: 2 },
  statGreen: { borderTopWidth: 3, borderTopColor: c.primary },
  statLabel: { fontSize: 10, color: c.textTertiary, fontWeight: '600', marginBottom: 8 },
  statValue: { fontSize: 36, fontWeight: '800', color: c.text, letterSpacing: -1 },
  section: { backgroundColor: c.card, borderRadius: 16, margin: 16, marginTop: 0, borderWidth: 0.5, borderColor: c.separator, overflow: 'hidden' },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 0.5, borderBottomColor: c.separatorLight },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: c.text },
  sectionSub: { fontSize: 12, color: c.textTertiary },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 0.5, borderBottomColor: c.separatorLight },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 13, fontWeight: '500', color: c.text },
  rowDate: { fontSize: 11, color: c.textTertiary, marginTop: 2 },
  rowPrice: { fontSize: 15, fontWeight: '700', color: c.primary, marginRight: 10 },
  paidBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.primaryLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  paidTxt: { fontSize: 10, fontWeight: '600', color: c.primary },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 0.5, borderBottomColor: c.separator },
  modalTitle: { fontSize: 18, fontWeight: '700', color: c.text },
  modalClose: { fontSize: 16, color: c.primary, fontWeight: '600' },
  label: { fontSize: 12, fontWeight: '600', color: c.textTertiary, marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 12, padding: 14, fontSize: 15, color: c.text },
  chip: { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  chipActive: { backgroundColor: c.primary, borderColor: c.primary },
  chipTxt: { fontSize: 13, color: c.text, fontWeight: '500' },
  submitBtn: { backgroundColor: c.primary, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 24, marginBottom: 40 },
  submitTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
