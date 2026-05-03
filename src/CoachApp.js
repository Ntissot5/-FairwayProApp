import { useState, useEffect, useMemo } from 'react'
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from './supabase'
import { useTheme } from './ThemeContext'
import { useTranslation } from 'react-i18next'
import AnimatedPressable from './components/AnimatedPressable'
import AnimatedListItem from './components/AnimatedListItem'
import { DashboardSkeleton } from './components/Skeleton'

export default function CoachApp({ navigation }) {
  const { colors, isDark } = useTheme()
  const { t } = useTranslation()
  const s = useMemo(() => makeStyles(colors, isDark), [colors, isDark])
  const [players, setPlayers] = useState([])
  const [sessions, setSessions] = useState([])
  const [todayLessons, setTodayLessons] = useState([])
  const [coachName, setCoachName] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [relancing, setRelancing] = useState({})

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCoachName(user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Coach')
    const { data: p } = await supabase.from('players').select('*').eq('coach_id', user.id)
    const { data: s } = await supabase.from('sessions').select('*').eq('coach_id', user.id).order('session_date', { ascending: false })
    // Fetch today's lessons for "next session" card
    const todayStr = new Date().toISOString().split('T')[0]
    const { data: tl } = await supabase.from('lessons').select('*, players(full_name, current_handicap)').eq('coach_id', user.id).eq('lesson_date', todayStr).order('start_time', { ascending: true })
    setPlayers(p || [])
    setSessions(s || [])
    setTodayLessons(tl || [])
    setLoading(false)
    setRefreshing(false)
  }

  const now = new Date()
  const thisMonth = sessions.filter(s => { const d = new Date(s.session_date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() })
  const revenueThisMonth = thisMonth.reduce((sum, s) => sum + (s.price || 0), 0)
  const totalRevenue = sessions.reduce((sum, s) => sum + (s.price || 0), 0)
  const sessionsThisMonth = thisMonth.length

  const monthlyData = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i)
    const month = d.getMonth(), year = d.getFullYear()
    const rev = sessions.filter(s => { const sd = new Date(s.session_date); return sd.getMonth() === month && sd.getFullYear() === year }).reduce((sum, s) => sum + (s.price || 0), 0)
    monthlyData.push({ label: d.toLocaleDateString('fr-FR', { month: 'short' }), value: rev })
  }
  const maxRev = Math.max(...monthlyData.map(m => m.value), 1)

  const inactivePlayers = players.filter(p => {
    const ps = sessions.filter(s => s.player_id === p.id)
    if (!ps.length) return true
    const last = ps.sort((a, b) => new Date(b.session_date) - new Date(a.session_date))[0]
    return Math.floor((now - new Date(last.session_date)) / (1000*60*60*24)) > 14
  })
  const activePlayers = players.length - inactivePlayers.length

  // Find next upcoming lesson today
  const nowTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0')
  const nextLesson = todayLessons.find(l => (l.start_time || '').slice(0, 5) >= nowTime && !l.is_private_event)
  const todayRevenueExpected = todayLessons.filter(l => !l.is_private_event).reduce((sum, l) => sum + (l.price || 0), 0)
  const todayLessonCount = todayLessons.filter(l => !l.is_private_event).length

  const relancePlayer = async (player) => {
    setRelancing(prev => ({ ...prev, [player.id]: true }))
    const ps = sessions.filter(s => s.player_id === player.id).sort((a, b) => new Date(b.session_date) - new Date(a.session_date))
    const last = ps[0]
    const days = last ? Math.floor((now - new Date(last.session_date)) / (1000*60*60*24)) : 99
    try {
      const { data: slots } = await supabase.from('availabilities').select('*').order('day_of_week')
      const DAYS = t('days.short', { returnObjects: true })
      const slotText = slots && slots.length > 0 ? 'Creneaux disponibles: ' + slots.map(s => DAYS[s.day_of_week] + ' ' + s.start_time?.slice(0,5)).join(', ') : ''
      const response = await fetch('https://aqdifzgqfemfdcigxsgw.supabase.co/functions/v1/claude-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 200, messages: [{ role: 'user', content: `Tu es un coach de golf professionnel. Ecris un message court et chaleureux pour relancer un eleve inactif sur le practice. Eleve: ${player.full_name}, HCP: ${player.current_handicap}, inactif depuis ${days} jours. ${slotText ? slotText + '. Propose un creneau precis.' : ''} 2-3 phrases max, pas de signature.` }] })
      })
      const data = await response.json()
      const msg = data.content?.[0]?.text?.trim()
      if (msg) {
        const { data: { user } } = await supabase.auth.getUser()
        await supabase.from('messages').insert({ coach_id: user.id, player_id: player.id, sender: 'coach', content: msg })
        alert('Message sent to ' + player.full_name)
      }
    } catch(e) { alert('Error: ' + e.message) }
    setRelancing(prev => ({ ...prev, [player.id]: false }))
  }

  if (loading) return <SafeAreaView style={s.safe}><DashboardSkeleton /></SafeAreaView>

  const greeting = now.getHours() < 12 ? t('home.goodMorning') : now.getHours() < 18 ? t('home.goodAfternoon') : t('home.goodEvening')

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll() }} tintColor={colors.primary} />}>
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>{greeting},</Text>
            <Text style={s.coachName}>{coachName}</Text>
          </View>
          <AnimatedPressable onPress={() => navigation.navigate('Settings')} style={s.settingsBtn}>
            <Ionicons name="settings-outline" size={20} color={colors.textTertiary} />
          </AnimatedPressable>
        </View>

        {/* CARD 1 — Prochaine session (green, motivating) */}
        {nextLesson ? (
          <AnimatedPressable style={s.nextSessionCard} onPress={() => nextLesson.players && navigation.navigate('PlayerDetail', { player: { id: nextLesson.player_id, full_name: nextLesson.players?.full_name, current_handicap: nextLesson.players?.current_handicap } })} haptic={false}>
            <View style={s.nextSessionIcon}>
              <Ionicons name="time" size={24} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.nextSessionLabel}>{t('home.nextSession')}</Text>
              <Text style={s.nextSessionName}>{nextLesson.players?.full_name || t('common.private')}</Text>
              <Text style={s.nextSessionTime}>{(nextLesson.start_time || '').slice(0, 5)} · {nextLesson.players?.current_handicap != null ? 'HCP ' + nextLesson.players.current_handicap : ''}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.6)" />
          </AnimatedPressable>
        ) : todayLessonCount > 0 ? (
          <View style={s.nextSessionCardDone}>
            <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.nextSessionDoneTitle}>{t('home.dayDone')}</Text>
              <Text style={s.nextSessionDoneSub}>{todayLessonCount} session{todayLessonCount > 1 ? 's' : ''} {t('common.today').toLowerCase()} · {todayRevenueExpected}€</Text>
            </View>
          </View>
        ) : null}

        {/* CARD 2 — Aujourd'hui (stats grid) */}
        <View style={s.todayCard}>
          <View style={s.todayRow}>
            <View style={s.todayStat}>
              <Text style={s.todayStatValue}>{todayLessonCount}</Text>
              <Text style={s.todayStatLabel}>{t('home.todayLessons')}</Text>
            </View>
            <View style={s.todayDivider} />
            <View style={s.todayStat}>
              <Text style={s.todayStatValue}>{todayRevenueExpected}€</Text>
              <Text style={s.todayStatLabel}>{t('home.expectedRevenue')}</Text>
            </View>
          </View>
          {todayLessons.filter(l => !l.is_private_event).length > 0 && (
            <View style={s.todayTimeline}>
              {todayLessons.filter(l => !l.is_private_event).map((l, i) => {
                const isPast = (l.start_time || '').slice(0, 5) < nowTime
                return (
                  <View key={l.id} style={s.todayTimelineRow}>
                    <Text style={[s.todayTimelineDot, isPast && { color: colors.primary }]}>{isPast ? '●' : '○'}</Text>
                    <Text style={[s.todayTimelineTime, isPast && { color: colors.textTertiary }]}>{(l.start_time || '').slice(0, 5)}</Text>
                    <Text style={[s.todayTimelineName, isPast && { color: colors.textTertiary }]}>{l.players?.full_name || t('common.private')}</Text>
                  </View>
                )
              })}
            </View>
          )}
        </View>

        {/* CARD 3 — Revenue this month */}
        <View style={s.statsGrid}>
          <View style={[s.statCard, s.statCardPrimary]}>
            <Text style={s.statCardLabel}>{t('home.thisMonth')}</Text>
            <Text style={s.statCardValuePrimary}>{revenueThisMonth}€</Text>
            <Text style={s.statCardSub}>{sessionsThisMonth} session{sessionsThisMonth !== 1 ? 's' : ''}</Text>
          </View>
          <View style={s.statCardCol}>
            <View style={s.statCardSmall}>
              <Text style={s.statSmallValue}>{players.length}</Text>
              <Text style={s.statSmallLabel}>{t('home.playersLabel')}</Text>
            </View>
            <View style={s.statCardSmall}>
              <Text style={s.statSmallValue}>{activePlayers}</Text>
              <Text style={[s.statSmallLabel, { color: colors.primary }]}>{t('home.active')}</Text>
            </View>
          </View>
        </View>

        {/* CARD 4 — À noter (amber, NOT red — only if inactive players exist) */}
        {inactivePlayers.length > 0 && (
          <View style={s.noteCard}>
            <View style={s.noteHeader}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
              <Text style={s.noteTitle}>{inactivePlayers.length} {t('home.toReengage')}</Text>
              <Text style={s.noteSub}>{t('home.inactiveDays')}</Text>
            </View>
            {inactivePlayers.slice(0, 3).map(p => (
              <View key={p.id} style={s.noteRow}>
                <View style={s.noteAvatar}><Text style={s.noteAvatarTxt}>{p.full_name?.charAt(0)}</Text></View>
                <Text style={s.noteName}>{p.full_name}</Text>
                <AnimatedPressable onPress={() => relancePlayer(p)} disabled={relancing[p.id]} style={s.relanceBtn}>
                  <Ionicons name="sparkles" size={12} color="#fff" />
                  <Text style={s.relanceBtnTxt}>{relancing[p.id] ? '...' : t('home.aiMessage')}</Text>
                </AnimatedPressable>
              </View>
            ))}
          </View>
        )}

        {/* Revenue chart */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>{t('home.revenue')}</Text>
            <AnimatedPressable onPress={() => navigation.navigate('Revenue')} haptic={false}>
              <Text style={s.cardLink}>{t('common.seeAll')}</Text>
            </AnimatedPressable>
          </View>
          <Text style={s.revenueTotal}>{totalRevenue}€ <Text style={s.revenueSub}>{t('home.total')}</Text></Text>
          <View style={s.chartRow}>
            {monthlyData.map((m, i) => {
              const h = m.value > 0 ? Math.max((m.value / maxRev) * 48, 4) : 3
              const isCurrent = i === monthlyData.length - 1
              return (
                <View key={i} style={s.chartBar}>
                  <View style={[s.bar, { height: h, backgroundColor: isCurrent ? colors.primary : colors.chartBarInactive }]} />
                  <Text style={[s.chartLabel, isCurrent && { color: colors.primary, fontWeight: '600' }]}>{m.label}</Text>
                </View>
              )
            })}
          </View>
        </View>

        {/* Quick actions */}
        <View style={s.actionsRow}>
          {[
            { icon: 'people-outline', label: t('home.playersLabel'), nav: 'Spaces' },
            { icon: 'calendar-outline', label: t('home.calendar'), nav: 'Calendar' },
            { icon: 'bar-chart-outline', label: t('home.revenue'), nav: 'Revenue' },
          ].map((a, i) => (
            <AnimatedPressable key={i} style={s.actionCard} onPress={() => navigation.navigate(a.nav)}>
              <Ionicons name={a.icon} size={22} color={colors.primary} />
              <Text style={s.actionLabel}>{a.label}</Text>
            </AnimatedPressable>
          ))}
        </View>

        {/* Recent sessions */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>{t('home.recentSessions')}</Text>
            <Text style={s.cardCount}>{sessions.length}</Text>
          </View>
          {sessions.length === 0 ? (
            <Text style={s.empty}>{t('home.noSessions')}</Text>
          ) : sessions.slice(0, 5).map((ses, i) => {
            const player = players.find(p => p.id === ses.player_id)
            return (
              <AnimatedListItem key={ses.id} index={i}>
                <AnimatedPressable style={s.sessionRow} onPress={() => player && navigation.navigate('PlayerDetail', { player })} haptic={false}>
                  <View style={s.sessionAvatar}><Text style={s.sessionAvatarTxt}>{player?.full_name?.charAt(0) || '?'}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.sessionName}>{player?.full_name || '—'}</Text>
                    <Text style={s.sessionDate}>{ses.session_date}{ses.notes ? ' · ' + ses.notes.slice(0, 25) : ''}</Text>
                  </View>
                  <Text style={s.sessionPrice}>{ses.price}€</Text>
                </AnimatedPressable>
              </AnimatedListItem>
            )
          })}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (c, isDark) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bgSecondary },
  scroll: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  greeting: { fontSize: 15, color: c.textTertiary, fontWeight: '500' },
  coachName: { fontSize: 28, fontWeight: '700', color: c.text, letterSpacing: -0.3, marginTop: 2 },
  settingsBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center', ...c.shadow },

  // Next session card (green, first thing coach sees)
  nextSessionCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 12, borderRadius: 16, padding: 18, backgroundColor: isDark ? '#0A2E1A' : c.primary },
  nextSessionIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  nextSessionLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5 },
  nextSessionName: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 2 },
  nextSessionTime: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  nextSessionCardDone: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 12, borderRadius: 16, padding: 18, backgroundColor: c.primaryLight },
  nextSessionDoneTitle: { fontSize: 15, fontWeight: '700', color: c.primary },
  nextSessionDoneSub: { fontSize: 12, color: c.textTertiary, marginTop: 2 },

  // Today card
  todayCard: { backgroundColor: c.card, marginHorizontal: 20, borderRadius: 16, padding: 18, marginBottom: 12, ...c.shadow },
  todayRow: { flexDirection: 'row', alignItems: 'center' },
  todayStat: { flex: 1, alignItems: 'center' },
  todayStatValue: { fontSize: 24, fontWeight: '800', color: c.text },
  todayStatLabel: { fontSize: 11, color: c.textTertiary, fontWeight: '500', marginTop: 2 },
  todayDivider: { width: 1, height: 36, backgroundColor: c.separatorLight, marginHorizontal: 12 },
  todayTimeline: { marginTop: 14, borderTopWidth: 0.5, borderTopColor: c.separatorLight, paddingTop: 12, gap: 8 },
  todayTimelineRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  todayTimelineDot: { fontSize: 8, color: c.textTertiary, width: 12 },
  todayTimelineTime: { fontSize: 13, fontWeight: '600', color: c.text, width: 45 },
  todayTimelineName: { fontSize: 13, color: c.text, flex: 1 },

  // Stats grid
  statsGrid: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 12 },
  statCard: { flex: 1.2, backgroundColor: c.card, borderRadius: 16, padding: 18, ...c.shadow },
  statCardPrimary: { backgroundColor: isDark ? '#0A2E1A' : c.primary },
  statCardLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  statCardValuePrimary: { fontSize: 32, fontWeight: '800', color: '#fff', marginTop: 4, letterSpacing: -1 },
  statCardSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  statCardCol: { flex: 0.8, gap: 10 },
  statCardSmall: { flex: 1, backgroundColor: c.card, borderRadius: 16, padding: 14, alignItems: 'center', justifyContent: 'center', ...c.shadow },
  statSmallValue: { fontSize: 24, fontWeight: '800', color: c.text },
  statSmallLabel: { fontSize: 11, color: c.textTertiary, fontWeight: '600', marginTop: 2 },

  // Note card (amber, not red — non-anxiogenic)
  noteCard: { backgroundColor: c.warningBg, marginHorizontal: 20, borderRadius: 16, padding: 16, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: c.warning },
  noteHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  noteTitle: { fontSize: 15, fontWeight: '700', color: c.warning, flex: 1 },
  noteSub: { fontSize: 11, color: c.textTertiary },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  noteAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: c.warning + '33', alignItems: 'center', justifyContent: 'center' },
  noteAvatarTxt: { color: c.warning, fontSize: 12, fontWeight: '700' },
  noteName: { flex: 1, fontSize: 14, fontWeight: '600', color: c.text },
  relanceBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  relanceBtnTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // Cards
  card: { backgroundColor: c.card, marginHorizontal: 20, borderRadius: 16, padding: 18, marginBottom: 12, ...c.shadow },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 17, fontWeight: '600', color: c.text },
  cardLink: { fontSize: 14, fontWeight: '500', color: c.primary },
  cardCount: { fontSize: 14, color: c.textTertiary, fontWeight: '600' },
  revenueTotal: { fontSize: 28, fontWeight: '800', color: c.text, letterSpacing: -0.5, marginBottom: 16 },
  revenueSub: { fontSize: 14, fontWeight: '400', color: c.textTertiary },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', height: 64, gap: 6 },
  chartBar: { flex: 1, alignItems: 'center', gap: 4 },
  bar: { width: '100%', borderRadius: 4 },
  chartLabel: { fontSize: 10, color: c.textTertiary },
  actionsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 12 },
  actionCard: { flex: 1, backgroundColor: c.card, borderRadius: 14, paddingVertical: 16, alignItems: 'center', gap: 4, ...c.shadow },
  actionLabel: { fontSize: 12, fontWeight: '600', color: c.text },
  empty: { padding: 20, textAlign: 'center', color: c.textTertiary, fontSize: 14 },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: c.separatorLight },
  sessionAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  sessionAvatarTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  sessionName: { fontSize: 15, fontWeight: '600', color: c.text },
  sessionDate: { fontSize: 12, color: c.textTertiary, marginTop: 1 },
  sessionPrice: { fontSize: 16, fontWeight: '700', color: c.primary },
})
