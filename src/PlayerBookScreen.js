import { useState, useEffect, useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from './supabase'
import { useTheme } from './ThemeContext'
import { useTranslation } from 'react-i18next'
import AnimatedPressable from './components/AnimatedPressable'
import { DashboardSkeleton } from './components/Skeleton'
const HOURS = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00']

export default function PlayerBookScreen() {
  const { colors } = useTheme()
  const { t } = useTranslation()
  const s = useMemo(() => makeStyles(colors), [colors])
  const DAYS = t('days.short', { returnObjects: true })
  const [lessons, setLessons] = useState([])
  const [player, setPlayer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: p } = await supabase.from('players').select('*').eq('player_user_id', user.id).single()
    if (p) {
      setPlayer(p)
      const { data: l } = await supabase.from('lessons').select('*, players(full_name)').eq('coach_id', p.coach_id).eq('is_private_event', false).order('lesson_date', { ascending: true })
      setLessons(l || [])
    }
    setLoading(false)
    setRefreshing(false)
  }

  const bookLesson = async (lesson) => {
    if (!player) return
    Alert.alert(t('playerBook.bookQuestion'), lesson.lesson_date + ' a ' + lesson.start_time?.slice(0,5) + ' — ' + (lesson.is_group ? t('common.group') : t('common.private')) + ' — ' + lesson.price + 'CHF', [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('playerBook.confirm'), onPress: async () => {
        const { error } = await supabase.from('lessons').update({ player_id: player.id }).eq('id', lesson.id)
        if (error) { Alert.alert('Erreur', error.message); return }
        setLessons(prev => prev.map(l => l.id === lesson.id ? { ...l, player_id: player.id, players: { full_name: player.full_name } } : l))
      }}
    ])
  }

  const cancelLesson = async (lesson) => {
    Alert.alert(t('playerBook.cancelQuestion'), '', [
      { text: t('common.no'), style: 'cancel' },
      { text: t('playerBook.yesCancel'), style: 'destructive', onPress: async () => {
        await supabase.from('lessons').update({ player_id: null }).eq('id', lesson.id)
        setLessons(prev => prev.map(l => l.id === lesson.id ? { ...l, player_id: null, players: null } : l))
      }}
    ])
  }

  const getWeekDates = () => {
    const now = new Date()
    const monday = new Date(now)
    monday.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1) + weekOffset * 7)
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d })
  }

  const weekDates = getWeekDates()
  const weekLabel = weekDates[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' — ' + weekDates[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
  const getLessonsForSlot = (date, time) => {
    const dateStr = date.toISOString().split('T')[0]
    return lessons.filter(l => l.lesson_date === dateStr && l.start_time?.slice(0,5) === time)
  }
  const isMyLesson = (lesson) => lesson.player_id === player?.id
  const isTaken = (lesson) => lesson.player_id !== null && lesson.player_id !== player?.id

  if (loading) return <SafeAreaView style={s.safe}><View style={s.header}><Text style={s.title}>{t('playerBook.title')}</Text></View><DashboardSkeleton /></SafeAreaView>

  const myLessons = lessons.filter(l => l.player_id === player?.id)

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>{t('playerBook.title')}</Text>
        <Text style={s.sub}>{t('playerBook.available')}</Text>
      </View>

      {myLessons.length > 0 && (
        <View style={s.myBookingsBar}>
          <Text style={s.myBookingsTitle}>{t('playerBook.myLessons', { count: myLessons.length })}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {myLessons.map(l => (
              <AnimatedPressable key={l.id} onPress={() => cancelLesson(l)} style={s.myBookingChip}>
                <Text style={s.myBookingChipTxt}>{l.lesson_date} {l.start_time?.slice(0,5)}</Text>
                <Text style={s.myBookingChipSub}>{l.is_group ? t('common.group') : t('common.private')} · {t('playerBook.cancelTap')}</Text>
              </AnimatedPressable>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={s.weekNav}>
        <AnimatedPressable onPress={() => setWeekOffset(weekOffset - 1)} style={s.weekBtn} haptic={false}>
          <Ionicons name="chevron-back" size={16} color={colors.primary} />
          <Text style={s.weekBtnTxt}>{t('common.previous')}</Text>
        </AnimatedPressable>
        <Text style={s.weekLabel}>{weekLabel}</Text>
        <AnimatedPressable onPress={() => setWeekOffset(weekOffset + 1)} style={s.weekBtn} haptic={false}>
          <Text style={s.weekBtnTxt}>{t('common.next')}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </AnimatedPressable>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll() }} tintColor={colors.primary} />}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={{ flexDirection: 'row', paddingLeft: 44 }}>
              {weekDates.map((date, i) => {
                const isToday = date.toDateString() === new Date().toDateString()
                return (
                  <View key={i} style={[s.dayHeader, isToday && { backgroundColor: colors.primary }]}>
                    <Text style={[s.dayName, isToday && { color: '#fff' }]}>{DAYS[i]}</Text>
                    <Text style={[s.dayNum, isToday && { color: '#fff' }]}>{date.getDate()}</Text>
                  </View>
                )
              })}
            </View>
            <ScrollView style={{ maxHeight: 520 }}>
              {HOURS.map(time => (
                <View key={time} style={{ flexDirection: 'row', alignItems: 'stretch', minHeight: 52 }}>
                  <View style={{ width: 44, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ fontSize: 9, color: colors.textTertiary }}>{time}</Text>
                  </View>
                  {weekDates.map((date, i) => {
                    const slotLessons = getLessonsForSlot(date, time)
                    return (
                      <View key={i} style={s.slot}>
                        {slotLessons.map((lesson, li) => {
                          const mine = isMyLesson(lesson)
                          const taken = isTaken(lesson)
                          const isGroup = lesson.is_group
                          return (
                            <TouchableOpacity key={li} onPress={() => { if (mine) cancelLesson(lesson); else if (!taken) bookLesson(lesson) }}
                              style={[s.lessonBlock, mine ? s.lessonBlockMine : taken ? s.lessonBlockTaken : isGroup ? s.lessonBlockGroup : s.lessonBlockPrivate]}>
                              <Text style={[s.lessonTime, mine && { color: '#fff' }, taken && { color: colors.textTertiary }]}>{time}</Text>
                              <Text style={[s.lessonName, mine && { color: '#fff', fontWeight: '700' }, taken && { color: colors.textTertiary }]} numberOfLines={1}>
                                {mine ? player?.full_name || t('playerBook.me') : taken ? t('playerBook.reserved') : isGroup ? t('common.group') : t('common.private')}
                              </Text>
                              <Text style={[s.lessonPrice, mine && { color: '#fff' }, taken && { color: colors.textTertiary }]}>
                                {mine ? t('playerBook.cancelAction') : taken ? '' : lesson.price + 'CHF'}
                              </Text>
                            </TouchableOpacity>
                          )
                        })}
                        {slotLessons.length === 0 && <View style={s.emptySlot} />}
                      </View>
                    )
                  })}
                </View>
              ))}
            </ScrollView>
          </View>
        </ScrollView>

        <View style={{ flexDirection: 'row', gap: 16, padding: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: colors.primaryLight }} />
            <Text style={{ fontSize: 10, color: colors.textTertiary }}>{t('playerBook.availableLabel')}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: colors.primary }} />
            <Text style={{ fontSize: 10, color: colors.textTertiary }}>{t('playerBook.myLesson')}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: colors.separator }} />
            <Text style={{ fontSize: 10, color: colors.textTertiary }}>{t('playerBook.reserved')}</Text>
          </View>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bgSecondary },
  header: { backgroundColor: c.card, padding: 16, paddingTop: 10, borderBottomWidth: 0.5, borderBottomColor: c.separator },
  title: { fontSize: 22, fontWeight: '800', color: c.text },
  sub: { fontSize: 12, color: c.textTertiary, marginTop: 2 },
  myBookingsBar: { backgroundColor: c.primaryLight, padding: 12, paddingHorizontal: 16, borderBottomWidth: 0.5, borderBottomColor: c.primary + '33' },
  myBookingsTitle: { fontSize: 12, fontWeight: '700', color: c.primary, marginBottom: 8 },
  myBookingChip: { backgroundColor: c.primary, borderRadius: 10, padding: 10, marginRight: 8 },
  myBookingChipTxt: { fontSize: 12, fontWeight: '700', color: '#fff' },
  myBookingChipSub: { fontSize: 10, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: c.card, borderBottomWidth: 0.5, borderBottomColor: c.separator },
  weekBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 },
  weekBtnTxt: { fontSize: 13, color: c.primary, fontWeight: '600' },
  weekLabel: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
  dayHeader: { width: 80, alignItems: 'center', padding: 8, borderRadius: 8, marginHorizontal: 2 },
  dayName: { fontSize: 10, fontWeight: '600', color: c.textTertiary },
  dayNum: { fontSize: 20, fontWeight: '800', color: c.text },
  slot: { width: 80, minHeight: 52, marginHorizontal: 2, borderRadius: 6, borderWidth: 0.5, borderColor: c.separatorLight, backgroundColor: c.card, justifyContent: 'center', padding: 3, marginBottom: 2 },
  emptySlot: { flex: 1 },
  lessonBlock: { width: '100%', borderRadius: 5, padding: 4 },
  lessonBlockPrivate: { backgroundColor: c.primaryLight },
  lessonBlockGroup: { backgroundColor: c.infoBg },
  lessonBlockMine: { backgroundColor: c.primary },
  lessonBlockTaken: { backgroundColor: c.separatorLight },
  lessonTime: { fontSize: 10, fontWeight: '700', color: c.primary },
  lessonName: { fontSize: 9, color: c.textSecondary, fontWeight: '500' },
  lessonPrice: { fontSize: 9, color: c.primary, fontWeight: '600' },
})
