import { useState, useEffect, useRef } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Animated } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Notifications from 'expo-notifications'
import { supabase } from './supabase'
import { registerForPushNotifications, savePushToken } from './notifications'
import PermissionPushModal from './components/PermissionPushModal'
import DailyBriefingCard from './components/DailyBriefingCard'
import { colors } from './theme'

function HeroCard({ icon, iconColor, bgColor, borderColor, title, children, delay, onPress }) {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(12)).current
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, delay, useNativeDriver: true }),
    ]).start()
  }, [])
  const Wrapper = onPress ? TouchableOpacity : View
  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <Wrapper onPress={onPress} style={[styles.heroCard, { backgroundColor: bgColor, borderColor }]}>
        <View style={styles.heroCardHeader}>
          <Ionicons name={icon} size={18} color={iconColor} />
          <Text style={styles.heroCardTitle}>{title}</Text>
        </View>
        {children}
      </Wrapper>
    </Animated.View>
  )
}

export default function CoachApp({ navigation }) {
  const { t } = useTranslation()
  const [players, setPlayers] = useState([])
  const [sessions, setSessions] = useState([])
  const [lessons, setLessons] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [relancing, setRelancing] = useState({})
  const [showPushModal, setShowPushModal] = useState(false)
  const [userId, setUserId] = useState(null)
  const briefingRef = useRef(null)

  useEffect(() => { fetchAll() }, [])

  // Push notification permission flow
  useEffect(() => {
    const checkPushPermission = async () => {
      // If already granted at system level, skip modal
      const { status } = await Notifications.getPermissionsAsync()
      if (status === 'granted') return

      const asked = await AsyncStorage.getItem('@push_asked')
      if (asked === 'granted') return

      if (asked) {
        // Check if 7 days have passed since "Later"
        const askedDate = new Date(asked)
        const now = new Date()
        const diffDays = (now - askedDate) / (1000 * 60 * 60 * 24)
        if (diffDays < 7) return
      }

      // Show modal after a short delay
      setTimeout(() => setShowPushModal(true), 1000)
    }
    checkPushPermission()
  }, [])

  const handleEnablePush = async () => {
    setShowPushModal(false)
    const token = await registerForPushNotifications()
    if (token) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await savePushToken(user.id, token)
    }
    await AsyncStorage.setItem('@push_asked', 'granted')
  }

  const handleLaterPush = async () => {
    setShowPushModal(false)
    await AsyncStorage.setItem('@push_asked', new Date().toISOString())
  }

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user.id)
    const today = new Date().toISOString().split('T')[0]
    const [pRes, sRes, lRes] = await Promise.all([
      supabase.from('players').select('*').eq('coach_id', user.id),
      supabase.from('sessions').select('*').eq('coach_id', user.id).order('session_date', { ascending: false }),
      supabase.from('lessons').select('*, players(full_name)').eq('coach_id', user.id).eq('lesson_date', today).order('start_time', { ascending: true }),
    ])
    setPlayers(pRes.data || [])
    setSessions(sRes.data || [])
    setLessons(lRes.data || [])
    setLoading(false)
    setRefreshing(false)
  }

  const now = new Date()
  const revenueThisMonth = sessions.filter(s => {
    const d = new Date(s.session_date)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).reduce((sum, s) => sum + (s.price || 0), 0)

  const inactivePlayers = players.filter(p => {
    const ps = sessions.filter(s => s.player_id === p.id)
    if (!ps.length) return true
    const last = ps.sort((a, b) => new Date(b.session_date) - new Date(a.session_date))[0]
    const days = Math.floor((now - new Date(last.session_date)) / (1000 * 60 * 60 * 24))
    return days > 14
  })

  const todayRevenue = lessons.reduce((sum, l) => sum + (l.price || 0), 0)
  const nextLesson = lessons[0]

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
      <ActivityIndicator color={colors.primary} size="large" />
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
          <TouchableOpacity onPress={() => navigation.navigate('Booking')} style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>+ {t('home.add_session')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.signOutBtn}>
            <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll(); if (briefingRef.current) briefingRef.current() }} tintColor={colors.primary} />}>

        {userId && <DailyBriefingCard userId={userId} ref={briefingRef} />}

        {/* Hero Cards */}
        <View style={styles.heroSection}>
          <HeroCard icon="flag-outline" iconColor={colors.primary} bgColor={colors.primaryLight} borderColor="#d1fae5" title={t('home.next_session')} delay={0}>
            {nextLesson ? (
              <View>
                <Text style={styles.heroMainText}>{nextLesson.players?.full_name || '—'}</Text>
                <Text style={styles.heroSubText}>{t('home.at_time', { time: nextLesson.start_time?.slice(0, 5) })}</Text>
                <TouchableOpacity style={styles.startSessionBtn} onPress={() => navigation.navigate('SessionLive', { lesson_id: nextLesson.id, player_id: nextLesson.player_id })}>
                  <Ionicons name="play" size={14} color={colors.textInverse} />
                  <Text style={styles.startSessionBtnTxt}>{t('session_live.start_session')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.heroSubText}>{t('home.no_session_today')}</Text>
            )}
          </HeroCard>

          <HeroCard icon="calendar-outline" iconColor={colors.textSecondary} bgColor={colors.surface} borderColor={colors.borderStrong} title={t('home.today')} delay={100}>
            <Text style={styles.heroMainText}>{t('home.sessions_today', { count: lessons.length })}</Text>
            {todayRevenue > 0 && <Text style={styles.heroSubText}>{t('home.expected_revenue', { amount: todayRevenue })}</Text>}
          </HeroCard>

          {inactivePlayers.length > 0 && (
            <HeroCard icon="alert-circle-outline" iconColor={colors.warning} bgColor={colors.surface} borderColor={colors.border} title={t('home.to_note')} delay={200}>
              <Text style={styles.heroMainText}>{t('home.students_to_contact', { count: inactivePlayers.length })}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {inactivePlayers.slice(0, 4).map(p => (
                  <TouchableOpacity key={p.id} onPress={() => navigation.navigate('PlayerDetail', { player: p })} style={styles.inactiveChip}>
                    <Text style={styles.inactiveChipTxt}>{p.full_name?.split(' ')[0]}</Text>
                  </TouchableOpacity>
                ))}
                {inactivePlayers.length > 4 && <Text style={{ fontSize: 11, color: colors.warning, alignSelf: 'center' }}>+{inactivePlayers.length - 4}</Text>}
              </View>
            </HeroCard>
          )}

          <HeroCard icon="wallet-outline" iconColor={colors.info} bgColor={colors.surface} borderColor={colors.border} title={t('home.revenue_this_month')} delay={300}>
            <Text style={[styles.heroMainText, { fontSize: 28, color: colors.textPrimary, letterSpacing: -1 }]}>{revenueThisMonth}€</Text>
          </HeroCard>
        </View>

        {/* Students list */}
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
              <TouchableOpacity key={p.id} style={styles.row} onPress={() => navigation.navigate("PlayerDetail", { player: p })}>
                <View style={[styles.av, inactive && styles.avAmber]}>
                  <Text style={styles.avTxt}>{p.full_name?.charAt(0)}</Text>
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName}>{p.full_name}</Text>
                  <Text style={styles.rowSub}>HCP {p.current_handicap} · {days ? t('home.days_ago', { days }) : t('players.never')}</Text>
                </View>
                <View style={[styles.badge, inactive ? styles.badgeAmber : styles.badgeGreen]}>
                  <Text style={[styles.badgeTxt, inactive ? { color: colors.warning } : { color: colors.primary }]}>{inactive ? t('home.inactive') : t('home.active')}</Text>
                </View>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Recent sessions */}
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

        <View style={{ height: 40 }} />
      </ScrollView>
      <PermissionPushModal visible={showPushModal} onEnable={handleEnablePush} onLater={handleLaterPush} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surfaceElevated },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { backgroundColor: colors.surface, padding: 20, paddingTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 0.5, borderBottomColor: colors.borderStrong },
  headerTitle: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
  headerDate: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  signOutBtn: { padding: 8 },
  scroll: { flex: 1 },

  // Hero cards
  heroSection: { padding: 16, gap: 10 },
  heroCard: { borderRadius: 16, padding: 16, borderWidth: 1 },
  heroCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  heroCardTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2, color: colors.textSecondary },
  heroMainText: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  heroSubText: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  inactiveChip: { backgroundColor: colors.surfaceElevated, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  inactiveChipTxt: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  startSessionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginTop: 10, alignSelf: 'flex-start' },
  startSessionBtnTxt: { fontSize: 13, fontWeight: '700', color: colors.textInverse },

  // Sections
  section: { backgroundColor: colors.surface, borderRadius: 16, margin: 16, marginTop: 0, overflow: 'hidden', borderWidth: 0.5, borderColor: colors.borderStrong },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, padding: 16, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  empty: { padding: 24, textAlign: 'center', color: colors.textTertiary, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderBottomWidth: 0.5, borderBottomColor: colors.surfaceElevated },
  av: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avAmber: { backgroundColor: '#FBBF24' },
  avTxt: { color: colors.textInverse, fontSize: 14, fontWeight: '700' },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  rowSub: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeGreen: { backgroundColor: colors.primaryLight },
  badgeAmber: { backgroundColor: colors.warningLight },
  badgeTxt: { fontSize: 10, fontWeight: '600' },
  price: { fontSize: 15, fontWeight: '700', color: colors.primary },
})
