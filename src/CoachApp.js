import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { supabase } from './supabase'

const G = '#1B5E35'

export default function CoachApp({ navigation }) {
  const { t } = useTranslation()
  const [players, setPlayers] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [relancing, setRelancing] = useState({})

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: p } = await supabase.from('players').select('*').eq('coach_id', user.id)
    const { data: s } = await supabase.from('sessions').select('*').eq('coach_id', user.id).order('session_date', { ascending: false })
    setPlayers(p || [])
    setSessions(s || [])
    setLoading(false)
    setRefreshing(false)
  }

  const now = new Date()
  const revenueThisMonth = sessions.filter(s => {
    const d = new Date(s.session_date)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).reduce((sum, s) => sum + (s.price || 0), 0)
  const totalRevenue = sessions.reduce((sum, s) => sum + (s.price || 0), 0)

  const inactivePlayers = players.filter(p => {
    const ps = sessions.filter(s => s.player_id === p.id)
    if (!ps.length) return true
    const last = ps.sort((a, b) => new Date(b.session_date) - new Date(a.session_date))[0]
    const days = Math.floor((now - new Date(last.session_date)) / (1000 * 60 * 60 * 24))
    return days > 14
  })

  const relancePlayer = async (player) => {
    setRelancing(prev => ({ ...prev, [player.id]: true }))
    const ps = sessions.filter(s => s.player_id === player.id).sort((a, b) => new Date(b.session_date) - new Date(a.session_date))
    const last = ps[0]
    const days = last ? Math.floor((now - new Date(last.session_date)) / (1000*60*60*24)) : 99
    try {
      const { data: slots } = await supabase.from('availabilities').select('*').order('day_of_week')
      const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
      const slotText = slots && slots.length > 0 ? 'Créneaux disponibles: ' + slots.map(s => DAYS[s.day_of_week] + ' ' + s.start_time?.slice(0,5)).join(', ') : ''
      const response = await fetch('https://aqdifzgqfemfdcigxsgw.supabase.co/functions/v1/claude-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 200, messages: [{ role: 'user', content: `Tu es un coach de golf professionnel. Écris un message court et chaleureux pour relancer un élève inactif sur le practice. Élève: ${player.full_name}, HCP: ${player.current_handicap}, inactif depuis ${days} jours. ${slotText ? slotText + '. Propose un créneau précis.' : ''} 2-3 phrases max, pas de signature.` }] })
      })
      const data = await response.json()
      const msg = data.content?.[0]?.text?.trim()
      if (msg) {
        const { data: { user } } = await supabase.auth.getUser()
        await supabase.from('messages').insert({ coach_id: user.id, player_id: player.id, sender: 'coach', content: msg })
        alert(t('home.message_sent', { name: player.full_name }))
      }
    } catch(e) { alert(t('common.error') + ': ' + e.message) }
    setRelancing(prev => ({ ...prev, [player.id]: false }))
  }

  if (loading) return (
    <View style={styles.loading}>
      <ActivityIndicator color={G} size="large" />
    </View>
  )

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{t('home.title')}</Text>
          <Text style={styles.headerDate}>{now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TouchableOpacity onPress={() => navigation.navigate('Booking')} style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: G, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: G }}>+ {t('home.add_session')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Players')} style={{ backgroundColor: G, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>+ {t('home.add_player')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.signOutBtn}>
            <Ionicons name="settings-outline" size={22} color="#6B7280" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll() }} tintColor={G} />}>

        {inactivePlayers.length > 0 && (
          <View style={styles.alert}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Ionicons name="alert-circle-outline" size={18} color="#DC2626" /><Text style={styles.alertTitle}>{t('home.inactive_alert', { count: inactivePlayers.length })}</Text></View>
            {inactivePlayers.map(p => (
              <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 10, marginTop: 8, borderTopWidth: 0.5, borderTopColor: '#FECACA' }}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#FCA5A5', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                  <Text style={{ color: '#DC2626', fontSize: 12, fontWeight: '700' }}>{p.full_name?.charAt(0)}</Text>
                </View>
                <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: '#DC2626' }}>{p.full_name}</Text>
                <TouchableOpacity onPress={() => relancePlayer(p)} disabled={relancing[p.id]} style={{ backgroundColor: relancing[p.id] ? '#E8F5EE' : '#1B5E35', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6 }}>
                  <Text style={{ color: relancing[p.id] ? '#1B5E35' : '#fff', fontSize: 11, fontWeight: '700' }}>{relancing[p.id] ? '...' : t('home.relaunch')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.navigate('PlayerDetail', { player: p })} style={{ backgroundColor: 'transparent', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#FECACA' }}>
                  <Text style={{ color: '#DC2626', fontSize: 11, fontWeight: '600' }}>{t('home.view')} →</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={styles.statsRow}>
          {[
            { label: t('home.this_month').toUpperCase(), value: revenueThisMonth + '€', green: true },
            { label: t('home.total').toUpperCase(), value: totalRevenue + '€' },
            { label: t('home.students').toUpperCase(), value: players.length },
            { label: t('home.sessions_count').toUpperCase(), value: sessions.length },
          ].map((s, i) => (
            <View key={i} style={[styles.stat, s.green && styles.statGreen]}>
              <Text style={styles.statLabel}>{s.label}</Text>
              <Text style={[styles.statValue, s.green && { color: G }]}>{s.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('home.my_students', { count: players.length })}</Text>
          {players.length === 0 ? (
            <Text style={styles.empty}>{t('home.no_students')}</Text>
          ) : players.map(p => {
            const ps = sessions.filter(s => s.player_id === p.id)
            const last = ps.sort((a, b) => new Date(b.session_date) - new Date(a.session_date))[0]
            const days = last ? Math.floor((now - new Date(last.session_date)) / (1000 * 60 * 60 * 24)) : null
            const inactive = !days || days > 14
            return (
              <TouchableOpacity key={p.id} style={[styles.row, inactive && styles.rowRed]} onPress={() => navigation.navigate("PlayerDetail", { player: p })}>
                <View style={[styles.av, inactive && styles.avRed]}>
                  <Text style={styles.avTxt}>{p.full_name?.charAt(0)}</Text>
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName}>{p.full_name}</Text>
                  <Text style={styles.rowSub}>HCP {p.current_handicap} · {days ? t('home.days_ago', { days }) : t('players.never')}</Text>
                </View>
                <View style={[styles.badge, inactive ? styles.badgeRed : styles.badgeGreen]}>
                  <Text style={[styles.badgeTxt, inactive ? { color: '#DC2626' } : { color: G }]}>{inactive ? t('home.inactive') : t('home.active')}</Text>
                </View>
              </TouchableOpacity>
            )
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('home.last_sessions')}</Text>
          {sessions.slice(0, 5).map(s => {
            const player = players.find(p => p.id === s.player_id)
            return (
              <TouchableOpacity key={s.id} style={styles.row} onPress={() => player && navigation.navigate("PlayerDetail", { player })}>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName}>{player?.full_name || '—'}</Text>
                  <Text style={styles.rowSub}>{s.session_date}</Text>
                </View>
                <Text style={styles.price}>{s.price}€</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <View style={styles.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 8 }}>
            <Text style={styles.sectionTitle}>{t('home.monthly_revenue')}</Text>
            <Text style={{ fontSize: 11, color: '#9CA3AF' }}>{t('home.six_months')}</Text>
          </View>
          <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <Text style={{ fontSize: 36, fontWeight: '800', color: G, letterSpacing: -1 }}>{revenueThisMonth}€</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 60, paddingHorizontal: 16, paddingBottom: 16, gap: 6 }}>
            {[0, 0, 0, 0, Math.round(totalRevenue * 0.17), revenueThisMonth].map((val, i) => {
              const maxVal = Math.max(revenueThisMonth, 1)
              const h = val > 0 ? Math.max((val / maxVal) * 44, 4) : 3
              return (
                <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                  <View style={{ width: '100%', height: h, backgroundColor: i === 5 ? G : '#E5E7EB', borderRadius: 3 }} />
                </View>
              )
            })}
          </View>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f8f8' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { backgroundColor: '#fff', padding: 20, paddingTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#1a1a1a', letterSpacing: -0.5 },
  headerDate: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  signOutBtn: { padding: 8 },
  scroll: { flex: 1 },
  alert: { margin: 16, backgroundColor: '#FEF2F2', borderRadius: 14, padding: 14, borderLeftWidth: 3, borderLeftColor: '#EF4444' },
  alertTitle: { fontSize: 13, fontWeight: '600', color: '#991B1B', marginBottom: 8 },
  statsRow: { flexDirection: 'row', gap: 8, margin: 16, marginTop: 16 },
  stat: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 0.5, borderColor: '#E5E7EB' },
  statGreen: { borderTopWidth: 2, borderTopColor: G },
  statLabel: { fontSize: 8, color: '#9CA3AF', fontWeight: '600', letterSpacing: 0.1, marginBottom: 6 },
  statValue: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', letterSpacing: -0.5 },
  section: { backgroundColor: '#fff', borderRadius: 16, margin: 16, marginTop: 0, overflow: 'hidden', borderWidth: 0.5, borderColor: '#E5E7EB' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', padding: 16, borderBottomWidth: 0.5, borderBottomColor: '#F0F4F0' },
  empty: { padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderBottomWidth: 0.5, borderBottomColor: '#F8FAF8' },
  rowRed: { backgroundColor: '#FEF2F2' },
  av: { width: 36, height: 36, borderRadius: 18, backgroundColor: G, alignItems: 'center', justifyContent: 'center' },
  avRed: { backgroundColor: '#FCA5A5' },
  avTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  rowSub: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeGreen: { backgroundColor: '#E8F5EE' },
  badgeRed: { backgroundColor: '#FEF2F2' },
  badgeTxt: { fontSize: 10, fontWeight: '600' },
  price: { fontSize: 15, fontWeight: '700', color: G },
})
