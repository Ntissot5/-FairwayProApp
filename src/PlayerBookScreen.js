import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from './supabase'

const G = '#1B5E35'
const DAYS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']
const HOURS = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00']

export default function PlayerBookScreen() {
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
      const { data: l } = await supabase.from('lessons')
        .select('*, players(full_name)')
        .eq('coach_id', p.coach_id)
        .eq('is_private_event', false)
        .order('lesson_date', { ascending: true })
      setLessons(l || [])
    }
    setLoading(false)
    setRefreshing(false)
  }

  const bookLesson = async (lesson) => {
    if (!player) return
    Alert.alert(
      'Réserver ce cours ?',
      lesson.lesson_date + ' a ' + lesson.start_time?.slice(0,5) + ' — ' + (lesson.is_group ? 'Collectif' : 'Cours prive') + ' — ' + lesson.price + 'CHF',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Confirmer', onPress: async () => {
          const { error } = await supabase.from('lessons')
            .update({ player_id: player.id })
            .eq('id', lesson.id)
          if (error) {
            Alert.alert('Erreur', error.message)
            return
          }
          // Update local state immediately
          setLessons(prev => prev.map(l => l.id === lesson.id ? { ...l, player_id: player.id, players: { full_name: player.full_name } } : l))
        }}
      ]
    )
  }

  const cancelLesson = async (lesson) => {
    Alert.alert('Annuler ce cours ?', '', [
      { text: 'Non', style: 'cancel' },
      { text: 'Oui annuler', style: 'destructive', onPress: async () => {
        await supabase.from('lessons').update({ player_id: null }).eq('id', lesson.id)
        setLessons(prev => prev.map(l => l.id === lesson.id ? { ...l, player_id: null, players: null } : l))
      }}
    ])
  }

  const getWeekDates = () => {
    const now = new Date()
    const monday = new Date(now)
    monday.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1) + weekOffset * 7)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return d
    })
  }

  const weekDates = getWeekDates()
  const weekLabel = weekDates[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' — ' + weekDates[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

  const getLessonsForSlot = (date, time) => {
    const dateStr = date.toISOString().split('T')[0]
    return lessons.filter(l => l.lesson_date === dateStr && l.start_time?.slice(0,5) === time)
  }

  const isMyLesson = (lesson) => lesson.player_id === player?.id
  const isTaken = (lesson) => lesson.player_id !== null && lesson.player_id !== player?.id

  if (loading) return <View style={s.loading}><ActivityIndicator color={G} size="large" /></View>

  // My booked lessons
  const myLessons = lessons.filter(l => l.player_id === player?.id)

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Booking</Text>
        <Text style={s.sub}>Cours disponibles</Text>
      </View>

      {/* My bookings summary */}
      {myLessons.length > 0 && (
        <View style={s.myBookingsBar}>
          <Text style={s.myBookingsTitle}>Mes cours ({myLessons.length})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {myLessons.map(l => (
              <TouchableOpacity key={l.id} onPress={() => cancelLesson(l)} style={s.myBookingChip}>
                <Text style={s.myBookingChipTxt}>{l.lesson_date} {l.start_time?.slice(0,5)}</Text>
                <Text style={s.myBookingChipSub}>{l.is_group ? 'Collectif' : 'Prive'} · Appuie pour annuler</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' }}>
        <TouchableOpacity onPress={() => setWeekOffset(weekOffset - 1)} style={s.weekBtn}>
          <Text style={s.weekBtnTxt}>Prec.</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }}>{weekLabel}</Text>
        <TouchableOpacity onPress={() => setWeekOffset(weekOffset + 1)} style={s.weekBtn}>
          <Text style={s.weekBtnTxt}>Suiv.</Text>
        </TouchableOpacity>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll() }} tintColor={G} />}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={{ flexDirection: 'row', paddingLeft: 44 }}>
              {weekDates.map((date, i) => {
                const isToday = date.toDateString() === new Date().toDateString()
                return (
                  <View key={i} style={[s.dayHeader, isToday && { backgroundColor: G }]}>
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
                    <Text style={{ fontSize: 9, color: '#9CA3AF' }}>{time}</Text>
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
                            <TouchableOpacity
                              key={li}
                              onPress={() => {
                                if (mine) cancelLesson(lesson)
                                else if (!taken) bookLesson(lesson)
                              }}
                              style={[
                                s.lessonBlock,
                                mine ? s.lessonBlockMine : taken ? s.lessonBlockTaken : isGroup ? s.lessonBlockGroup : s.lessonBlockPrivate
                              ]}
                            >
                              <Text style={[s.lessonTime, mine && { color: '#fff' }, taken && { color: '#9CA3AF' }]}>{time}</Text>
                              <Text style={[s.lessonName, mine && { color: '#fff', fontWeight: '700' }, taken && { color: '#9CA3AF' }]} numberOfLines={1}>
                                {mine ? player?.full_name || 'Moi' : taken ? 'Reserve' : isGroup ? 'Collectif' : 'Cours prive'}
                              </Text>
                              <Text style={[s.lessonPrice, mine && { color: '#fff' }, taken && { color: '#9CA3AF' }]}>
                                {mine ? 'Annuler?' : taken ? '' : lesson.price + 'CHF'}
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
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#E8F5EE' }} />
            <Text style={{ fontSize: 10, color: '#6B7280' }}>Disponible</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: G }} />
            <Text style={{ fontSize: 10, color: '#6B7280' }}>Mon cours</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#E5E7EB' }} />
            <Text style={{ fontSize: 10, color: '#6B7280' }}>Reserve</Text>
          </View>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f8f8' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { backgroundColor: '#fff', padding: 16, paddingTop: 10, borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
  title: { fontSize: 22, fontWeight: '800', color: '#1a1a1a' },
  sub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  myBookingsBar: { backgroundColor: '#E8F5EE', padding: 12, paddingHorizontal: 16, borderBottomWidth: 0.5, borderBottomColor: '#D1FAE5' },
  myBookingsTitle: { fontSize: 12, fontWeight: '700', color: G, marginBottom: 8 },
  myBookingChip: { backgroundColor: G, borderRadius: 10, padding: 10, marginRight: 8 },
  myBookingChipTxt: { fontSize: 12, fontWeight: '700', color: '#fff' },
  myBookingChipSub: { fontSize: 10, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  weekBtn: { padding: 4 },
  weekBtnTxt: { fontSize: 13, color: G, fontWeight: '600' },
  dayHeader: { width: 80, alignItems: 'center', padding: 8, borderRadius: 8, marginHorizontal: 2 },
  dayName: { fontSize: 10, fontWeight: '600', color: '#9CA3AF' },
  dayNum: { fontSize: 20, fontWeight: '800', color: '#1a1a1a' },
  slot: { width: 80, minHeight: 52, marginHorizontal: 2, borderRadius: 6, borderWidth: 0.5, borderColor: '#F0F4F0', backgroundColor: '#FAFFFE', justifyContent: 'center', padding: 3, marginBottom: 2 },
  emptySlot: { flex: 1 },
  lessonBlock: { width: '100%', borderRadius: 5, padding: 4 },
  lessonBlockPrivate: { backgroundColor: '#E8F5EE' },
  lessonBlockGroup: { backgroundColor: '#EEF2FF' },
  lessonBlockMine: { backgroundColor: G },
  lessonBlockTaken: { backgroundColor: '#F3F4F6' },
  lessonTime: { fontSize: 10, fontWeight: '700', color: G },
  lessonName: { fontSize: 9, color: '#374151', fontWeight: '500' },
  lessonPrice: { fontSize: 9, color: G, fontWeight: '600' },
})
