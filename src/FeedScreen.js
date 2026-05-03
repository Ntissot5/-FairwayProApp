import { useState, useEffect, useMemo } from 'react'
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from './supabase'
import { useTheme } from './ThemeContext'
import { useTranslation } from 'react-i18next'
import AnimatedPressable from './components/AnimatedPressable'
import AnimatedListItem from './components/AnimatedListItem'
import { PlayerListSkeleton } from './components/Skeleton'

export default function FeedScreen({ navigation }) {
  const { colors } = useTheme()
  const { t } = useTranslation()
  const s = useMemo(() => makeStyles(colors), [colors])
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const avatarColors = colors.avatarColors

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: players } = await supabase.from('players').select('*').eq('coach_id', user.id)
    if (!players || players.length === 0) { setConversations([]); setLoading(false); setRefreshing(false); return }
    const playerIds = players.map(p => p.id)
    const [msgRes, vidRes, sesRes, hcpRes] = await Promise.all([
      supabase.from('messages').select('*').in('player_id', playerIds).order('created_at', { ascending: false }),
      supabase.from('swing_videos').select('*').in('player_id', playerIds).order('created_at', { ascending: false }),
      supabase.from('sessions').select('*').in('player_id', playerIds).order('session_date', { ascending: false }),
      supabase.from('handicap_history').select('*').in('player_id', playerIds).order('date', { ascending: false }),
    ])
    const msgs = msgRes.data || [], vids = vidRes.data || [], sessions = sesRes.data || [], hcpData = hcpRes.data || []
    const now = new Date()
    const convos = players.map((p, idx) => {
      const playerMsgs = msgs.filter(m => m.player_id === p.id)
      const playerVids = vids.filter(v => v.player_id === p.id)
      const playerSessions = sessions.filter(s => s.player_id === p.id)
      const playerHcp = hcpData.filter(h => h.player_id === p.id)
      const lastItems = []
      if (playerMsgs[0]) lastItems.push({ type: 'message', date: playerMsgs[0].created_at, data: playerMsgs[0] })
      if (playerVids[0]) lastItems.push({ type: 'video', date: playerVids[0].created_at, data: playerVids[0] })
      if (playerSessions[0]) lastItems.push({ type: 'session', date: playerSessions[0].session_date || playerSessions[0].created_at, data: playerSessions[0] })
      lastItems.sort((a, b) => new Date(b.date) - new Date(a.date))
      const lastItem = lastItems[0]
      let preview = t('feed.noActivity')
      if (lastItem) {
        switch (lastItem.type) {
          case 'message': preview = (lastItem.data.sender === 'coach' ? 'You: ' : '') + (lastItem.data.content?.slice(0, 60) || ''); break
          case 'video': preview = (lastItem.data.title || t('playerDetail.swingVideo')); break
          case 'session': preview = 'Session · ' + (lastItem.data.price || 0) + '€'; break
        }
      }
      let hcpTrend = 'flat'
      if (playerHcp.length >= 2) {
        const diff = playerHcp[0].handicap - playerHcp[1].handicap
        if (diff < -0.2) hcpTrend = 'down'
        else if (diff > 0.2) hcpTrend = 'up'
      }
      const lastSession = playerSessions[0]
      const daysSince = lastSession ? Math.floor((now - new Date(lastSession.session_date)) / (1000*60*60*24)) : null
      const inactive = daysSince === null || daysSince > 14
      const lastCoachMsg = playerMsgs.find(m => m.sender === 'coach')
      const unread = playerMsgs.filter(m => m.sender === 'player' && (!lastCoachMsg || new Date(m.created_at) > new Date(lastCoachMsg.created_at))).length
      return { player: p, color: avatarColors[idx % avatarColors.length], lastDate: lastItem?.date || null, preview, hcpTrend, inactive, daysSince, unread, sessionCount: playerSessions.length }
    })
    convos.sort((a, b) => {
      if (a.unread > 0 && b.unread === 0) return -1
      if (b.unread > 0 && a.unread === 0) return 1
      if (!a.lastDate) return 1
      if (!b.lastDate) return -1
      return new Date(b.lastDate) - new Date(a.lastDate)
    })
    setConversations(convos)
    setLoading(false)
    setRefreshing(false)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr), now = new Date(), diff = now - d
    if (diff < 60000) return 'Now'
    if (diff < 3600000) return Math.floor(diff / 60000) + 'min'
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h'
    if (diff < 604800000) return d.toLocaleDateString('fr-FR', { weekday: 'short' })
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  if (loading) return <SafeAreaView style={s.safe}><View style={s.header}><View><Text style={s.headerTitle}>{t('feed.title')}</Text></View></View><PlayerListSkeleton /></SafeAreaView>

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>{t('feed.title')}</Text>
          <Text style={s.headerSub}>{conversations.length} {t('common.player')}{conversations.length !== 1 ? 's' : ''}</Text>
        </View>
        <AnimatedPressable onPress={() => navigation.navigate('Settings')} style={s.settingsBtn}>
          <Ionicons name="settings-outline" size={20} color={colors.textTertiary} />
        </AnimatedPressable>
      </View>

      <ScrollView style={s.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll() }} tintColor={colors.primary} />}>
        {conversations.length === 0 ? (
          <View style={s.emptyState}>
            <Ionicons name="flag-outline" size={48} color={colors.separator} />
            <Text style={s.emptyTitle}>{t('feed.welcome')}</Text>
            <Text style={s.emptySub}>{t('feed.welcomeSub')}</Text>
            <AnimatedPressable style={s.emptyBtn} onPress={() => navigation.navigate('Spaces')}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={s.emptyBtnTxt}>{t('feed.addPlayer')}</Text>
            </AnimatedPressable>
          </View>
        ) : (
          conversations.map((c, i) => (
            <AnimatedListItem key={c.player.id} index={i}>
              <AnimatedPressable style={[s.convoRow, c.unread > 0 && s.convoUnread]} onPress={() => navigation.navigate('PlayerDetail', { player: c.player })} haptic={false}>
                <View style={s.avatarWrap}>
                  <View style={[s.avatar, { backgroundColor: c.color }]}>
                    <Text style={s.avatarTxt}>{c.player.full_name?.charAt(0)}</Text>
                  </View>
                  <View style={[s.trendDot, c.hcpTrend === 'down' && s.trendDown, c.hcpTrend === 'up' && s.trendUp, c.hcpTrend === 'flat' && s.trendFlat]} />
                </View>
                <View style={s.convoContent}>
                  <View style={s.convoTop}>
                    <Text style={[s.convoName, c.unread > 0 && { fontWeight: '800' }]}>{c.player.full_name}</Text>
                    <Text style={[s.convoTime, c.unread > 0 && { color: colors.primary }]}>{formatDate(c.lastDate)}</Text>
                  </View>
                  <View style={s.convoBottom}>
                    <Text style={[s.convoPreview, c.unread > 0 && { color: colors.text, fontWeight: '500' }]} numberOfLines={2}>{c.preview}</Text>
                  </View>
                  <View style={s.convoMeta}>
                    <Text style={s.convoHcp}>HCP {c.player.current_handicap}</Text>
                    {c.hcpTrend === 'down' && <Text style={[s.trendLabel, { color: colors.success }]}>{t('feed.improving')}</Text>}
                    {c.hcpTrend === 'up' && <Text style={[s.trendLabel, { color: colors.destructive }]}>{t('feed.rising')}</Text>}
                    {c.inactive && <Text style={s.inactiveLabel}>{t('feed.inactive')}</Text>}
                    {c.unread > 0 && (
                      <View style={s.unreadBadge}><Text style={s.unreadTxt}>{c.unread}</Text></View>
                    )}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.separator} style={{ marginLeft: 8 }} />
              </AnimatedPressable>
            </AnimatedListItem>
          ))
        )}
        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 0.5, borderBottomColor: c.separatorLight },
  headerTitle: { fontSize: 28, fontWeight: '800', color: c.text, letterSpacing: -0.5 },
  headerSub: { fontSize: 12, color: c.textTertiary, marginTop: 2 },
  settingsBtn: { padding: 8 },
  scroll: { flex: 1 },
  convoRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: c.separatorLight },
  convoUnread: { backgroundColor: c.primaryLight },
  avatarWrap: { position: 'relative', marginRight: 14 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontSize: 20, fontWeight: '700' },
  trendDot: { position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: c.bg },
  trendDown: { backgroundColor: '#22c55e' },
  trendUp: { backgroundColor: '#EF4444' },
  trendFlat: { backgroundColor: c.separator },
  convoContent: { flex: 1 },
  convoTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  convoName: { fontSize: 16, fontWeight: '600', color: c.text },
  convoTime: { fontSize: 12, color: c.textTertiary },
  convoBottom: { marginTop: 3 },
  convoPreview: { fontSize: 14, color: c.textTertiary, lineHeight: 19 },
  convoMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  convoHcp: { fontSize: 11, color: c.textTertiary, fontWeight: '600' },
  trendLabel: { fontSize: 11, fontWeight: '600' },
  inactiveLabel: { fontSize: 10, color: c.destructive, fontWeight: '600', backgroundColor: c.destructiveBg, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, overflow: 'hidden' },
  unreadBadge: { backgroundColor: c.primary, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingVertical: 80, gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: c.text },
  emptySub: { fontSize: 14, color: c.textTertiary },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14, marginTop: 12 },
  emptyBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
})
