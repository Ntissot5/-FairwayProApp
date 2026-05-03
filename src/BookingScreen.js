import { useState, useEffect, useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Modal, TextInput, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from './supabase'
import { useTheme } from './ThemeContext'
import { useTranslation } from 'react-i18next'
import AnimatedPressable from './components/AnimatedPressable'
import { CardListSkeleton } from './components/Skeleton'
const HOURS = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00']

export default function BookingScreen({ navigation }) {
  const { colors, isDark } = useTheme()
  const { t } = useTranslation()
  const s = useMemo(() => makeStyles(colors), [colors])
  const DAYS = t('days.short', { returnObjects: true })

  const [tab, setTab] = useState('agenda')
  const [workHours, setWorkHours] = useState([])
  const [collectifs, setCollectifs] = useState([])
  const [prefs, setPrefs] = useState({ default_duration: 60, max_group_size: 4, private_price: 120, group_price: 25 })
  const [lessons, setLessons] = useState([])
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)
  const [userId, setUserId] = useState(null)
  const [newWH, setNewWH] = useState({ day_of_week: 0, start_time: '08:00', end_time: '12:00' })
  const [newCol, setNewCol] = useState({ day_of_week: 1, start_time: '17:00', duration_minutes: 60, max_players: 3 })

  // Add lesson modal
  const [showAddLesson, setShowAddLesson] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [lessonType, setLessonType] = useState('private')
  const [savingLesson, setSavingLesson] = useState(false)
  const [eventTitle, setEventTitle] = useState('')

  // Slot detail modal
  const [showSlotDetail, setShowSlotDetail] = useState(false)
  const [slotDetail, setSlotDetail] = useState(null)

  useEffect(() => { fetchAll() }, [weekOffset])

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user.id)
    // Compute date range: 4 weeks before and after current week view
    const now = new Date()
    const rangeStart = new Date(now)
    rangeStart.setDate(now.getDate() + (weekOffset - 4) * 7)
    const rangeEnd = new Date(now)
    rangeEnd.setDate(now.getDate() + (weekOffset + 4) * 7)
    const startStr = rangeStart.toISOString().split('T')[0]
    const endStr = rangeEnd.toISOString().split('T')[0]

    const { data: wh } = await supabase.from('work_hours').select('*').eq('coach_id', user.id).order('day_of_week')
    const { data: col } = await supabase.from('availabilities').select('*').eq('coach_id', user.id).order('day_of_week')
    const { data: p } = await supabase.from('coach_preferences').select('*').eq('coach_id', user.id).single()
    const { data: l } = await supabase.from('lessons').select('*, players(full_name, current_handicap)').eq('coach_id', user.id).gte('lesson_date', startStr).lte('lesson_date', endStr)
    const { data: pl } = await supabase.from('players').select('*').eq('coach_id', user.id)
    setWorkHours(wh || [])
    setCollectifs(col || [])
    if (p) setPrefs(p)
    setLessons(l || [])
    setPlayers(pl || [])
    setLoading(false)
  }

  const addWorkHour = async () => {
    await supabase.from('work_hours').insert({ coach_id: userId, day_of_week: newWH.day_of_week, start_time: newWH.start_time + ':00', end_time: newWH.end_time + ':00' })
    fetchAll()
  }

  const deleteWorkHour = async (id) => {
    await supabase.from('work_hours').delete().eq('id', id)
    fetchAll()
  }

  const addCollectif = async () => {
    const colPrice = prefs.group_price || 25
    await supabase.from('availabilities').insert({ coach_id: userId, day_of_week: newCol.day_of_week, start_time: newCol.start_time + ':00', duration_minutes: parseInt(newCol.duration_minutes), max_players: parseInt(newCol.max_players), price: colPrice * parseInt(newCol.max_players) })
    fetchAll()
  }

  const deleteCollectif = async (id) => {
    await supabase.from('availabilities').delete().eq('id', id)
    fetchAll()
  }

  const savePrefs = async () => {
    const existing = await supabase.from('coach_preferences').select('id').eq('coach_id', userId).single()
    if (existing.data) {
      await supabase.from('coach_preferences').update({ ...prefs, coach_id: userId }).eq('coach_id', userId)
    } else {
      await supabase.from('coach_preferences').insert({ ...prefs, coach_id: userId })
    }
    Alert.alert(t('booking.prefsSaved'))
    fetchAll()
  }

  const addLesson = async () => {
    if (!selectedSlot) return
    setSavingLesson(true)
    const { error } = await supabase.from('lessons').insert({
      coach_id: userId,
      player_id: lessonType === 'event' ? null : selectedPlayer,
      lesson_date: selectedSlot.date,
      start_time: selectedSlot.time + ':00',
      end_time: selectedSlot.time + ':00',
      duration_minutes: prefs.default_duration || 60,
      is_group: lessonType === 'group',
      is_private_event: lessonType === 'event',
      event_type: lessonType,
      title: lessonType === 'event' ? eventTitle : null,
      price: lessonType === 'private' ? (prefs.private_price || 120) : lessonType === 'group' ? (prefs.group_price || 25) : 0
    })
    if (error) {
      Alert.alert('Erreur', error.message)
    } else if (lessonType !== 'event' && selectedPlayer) {
      await supabase.from('sessions').insert({
        coach_id: userId,
        player_id: selectedPlayer,
        price: lessonType === 'private' ? (prefs.private_price || 120) : (prefs.group_price || 25),
        session_date: selectedSlot.date,
        notes: lessonType === 'group' ? 'Cours collectif' : 'Cours prive',
        paid: false
      })
    }
    setSavingLesson(false)
    setShowAddLesson(false)
    setSelectedPlayer(null)
    setEventTitle('')
    fetchAll()
  }

  const deleteLesson = async (id) => {
    Alert.alert(t('booking.deleteLesson'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => {
        await supabase.from('lessons').delete().eq('id', id)
        setShowSlotDetail(false)
        fetchAll()
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
  const weekLabel = weekDates[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' \u2014 ' + weekDates[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

  const getLessonsForSlot = (date, time) => {
    const dateStr = date.toISOString().split('T')[0]
    return lessons.filter(l => l.lesson_date === dateStr && l.start_time?.slice(0,5) === time)
  }

  const getCollectifsForDay = (date) => {
    const dow = date.getDay() === 0 ? 6 : date.getDay() - 1
    return collectifs.filter(c => c.day_of_week === dow)
  }

  const isWorkingHour = (date, time) => {
    const dow = date.getDay() === 0 ? 6 : date.getDay() - 1
    const wh = workHours.filter(w => w.day_of_week === dow)
    if (wh.length === 0) return true
    return wh.some(w => {
      const start = (w.start_time || '').slice(0, 5)
      const end = (w.end_time || '').slice(0, 5)
      return time >= start && time < end
    })
  }

  if (loading) return (
    <View style={s.loading}>
      <CardListSkeleton />
    </View>
  )

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>{t('booking.title')}</Text>
      </View>

      <View style={s.tabs}>
        {[{key:'agenda',label:t('booking.agenda')},{key:'horaires',label:t('booking.schedule')},{key:'preferences',label:t('booking.preferences')}].map(tItem => (
          <TouchableOpacity key={tItem.key} style={[s.tab, tab === tItem.key && s.tabActive]} onPress={() => setTab(tItem.key)}>
            <Text style={[s.tabTxt, tab === tItem.key && s.tabTxtActive]}>{tItem.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'agenda' && (
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 }}>
            <TouchableOpacity onPress={() => setWeekOffset(weekOffset - 1)} style={s.weekBtn}>
              <Ionicons name="chevron-back" size={16} color={colors.primary} />
              <Text style={s.weekBtnTxt}> {t('common.previous')}</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>{weekLabel}</Text>
            <TouchableOpacity onPress={() => setWeekOffset(weekOffset + 1)} style={s.weekBtn}>
              <Text style={s.weekBtnTxt}>{t('common.next')} </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              {/* Day headers */}
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

              {/* Time slots */}
              <ScrollView style={{ maxHeight: 500 }}>
                {HOURS.map(time => (
                  <View key={time} style={{ flexDirection: 'row', alignItems: 'stretch', minHeight: 52 }}>
                    <View style={{ width: 44, justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ fontSize: 9, color: colors.textTertiary }}>{time}</Text>
                    </View>
                    {weekDates.map((date, i) => {
                      const dow = date.getDay() === 0 ? 6 : date.getDay() - 1
                      const isWorking = isWorkingHour(date, time)
                      const slotLessons = getLessonsForSlot(date, time)
                      const col = collectifs.find(c => c.day_of_week === dow && c.start_time?.startsWith(time))
                      const dateStr = date.toISOString().split('T')[0]
                      const isPast = date < new Date() && date.toDateString() !== new Date().toDateString()

                      return (
                        <TouchableOpacity
                          key={i}
                          style={[s.slot, !isWorking && s.slotEmpty]}
                          onPress={() => {
                            if (slotLessons.length > 0 || col) {
                              setSlotDetail({ date: dateStr, time, lessons: slotLessons, collectif: col })
                              setShowSlotDetail(true)
                            } else {
                              setSelectedSlot({ date: dateStr, time })
                              setShowAddLesson(true)
                            }
                          }}
                        >
                          {col && slotLessons.length === 0 && (
                            <View style={s.collectifBlock}>
                              <Text style={s.collectifTime}>{time}</Text>
                              <Text style={s.collectifLabel}>Collectif \u00B7 max {col.max_players}</Text>
                              <Text style={s.collectifPrice}>{prefs.group_price || 25}\u20AC/el.</Text>
                            </View>
                          )}
                          {slotLessons.map((lesson, li) => (
                            <View key={li} style={[s.lessonBlock, lesson.is_private_event ? { backgroundColor: '#FEF3C7' } : lesson.is_group ? s.lessonBlockGroup : s.lessonBlockPrivate]}>
                              <Text style={[s.lessonTime, lesson.is_private_event && { color: '#D97706' }]}>{time}</Text>
                              <Text style={s.lessonName} numberOfLines={1}>{lesson.is_private_event ? (lesson.title || 'Evenement') : (lesson.players?.full_name || 'Cours prive')}</Text>
                              {!lesson.is_private_event && <Text style={s.lessonPrice}>{lesson.price}\u20AC</Text>}
                            </View>
                          ))}
                          {isWorking && slotLessons.length === 0 && !col && (
                            <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                              <Text style={{ fontSize: 18, color: colors.separator, fontWeight: '300' }}>+</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                ))}
              </ScrollView>
            </View>
          </ScrollView>

          {/* Legend */}
          <View style={{ flexDirection: 'row', gap: 16, padding: 12, paddingTop: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: colors.primaryLight }} /><Text style={{ fontSize: 10, color: colors.textTertiary }}>Cours prive</Text></View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#EEF2FF' }} /><Text style={{ fontSize: 10, color: colors.textTertiary }}>Collectif</Text></View>
          </View>
        </View>
      )}

      {tab === 'horaires' && (
        <ScrollView style={s.scroll}>
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('booking.workHours')}</Text>
            <Text style={s.sectionSub}>{t('booking.workHoursDesc')}</Text>
            <View style={{ marginBottom: 12 }}>
              <Text style={s.label}>{t('booking.day')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {DAYS.map((d, i) => (
                  <TouchableOpacity key={i} onPress={() => setNewWH({...newWH, day_of_week: i})} style={[s.chip, newWH.day_of_week === i && s.chipActive]}>
                    <Text style={[s.chipTxt, newWH.day_of_week === i && { color: '#fff' }]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>{t('booking.start')}</Text>
                  <TextInput style={s.input} value={newWH.start_time} onChangeText={v => setNewWH({...newWH, start_time: v})} placeholder="08:00" placeholderTextColor={colors.textTertiary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>{t('booking.end')}</Text>
                  <TextInput style={s.input} value={newWH.end_time} onChangeText={v => setNewWH({...newWH, end_time: v})} placeholder="12:00" placeholderTextColor={colors.textTertiary} />
                </View>
                <AnimatedPressable style={[s.addBtn, { alignSelf: 'flex-end' }]} onPress={addWorkHour}>
                  <Text style={s.addBtnTxt}>+ {t('common.add')}</Text>
                </AnimatedPressable>
              </View>
            </View>
            {DAYS.map((day, i) => {
              const wh = workHours.filter(w => w.day_of_week === i)
              if (wh.length === 0) return null
              return (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ width: 36, fontSize: 12, color: colors.textSecondary, fontWeight: '600' }}>{day}</Text>
                  {wh.map(w => (
                    <TouchableOpacity key={w.id} onPress={() => deleteWorkHour(w.id)} style={s.whChip}>
                      <Text style={s.whChipTxt}>{w.start_time?.slice(0,5)} \u2014 {w.end_time?.slice(0,5)} \u00D7</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )
            })}
          </View>

          <View style={s.section}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="people-outline" size={16} color={colors.text} />
              <Text style={s.sectionTitle}>{t('booking.groupSlots')}</Text>
            </View>
            <Text style={s.sectionSub}>{t('booking.groupSlotsDesc')}</Text>
            <Text style={s.label}>{t('booking.day')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {DAYS.map((d, i) => (
                <TouchableOpacity key={i} onPress={() => setNewCol({...newCol, day_of_week: i})} style={[s.chip, newCol.day_of_week === i && s.chipActive]}>
                  <Text style={[s.chipTxt, newCol.day_of_week === i && { color: '#fff' }]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>{t('booking.hour')}</Text>
                <TextInput style={s.input} value={newCol.start_time} onChangeText={v => setNewCol({...newCol, start_time: v})} placeholder="17:00" placeholderTextColor={colors.textTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>{t('booking.duration')}</Text>
                <TextInput style={s.input} value={String(newCol.duration_minutes)} onChangeText={v => setNewCol({...newCol, duration_minutes: v})} keyboardType="numeric" placeholderTextColor={colors.textTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>{t('booking.maxStudents')}</Text>
                <TextInput style={s.input} value={String(newCol.max_players)} onChangeText={v => setNewCol({...newCol, max_players: v})} keyboardType="numeric" placeholderTextColor={colors.textTertiary} />
              </View>
            </View>
            <AnimatedPressable style={[s.addBtn, { marginTop: 10 }]} onPress={addCollectif}>
              <Text style={s.addBtnTxt}>+ {t('common.add')}</Text>
            </AnimatedPressable>
            {collectifs.map(c => (
              <View key={c.id} style={[s.whChip, { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 }]}>
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#3730A3' }}>
                    {DAYS[c.day_of_week]} \u00B7 {c.start_time?.slice(0,5)}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textTertiary }}>max {c.max_players} eleves \u00B7 {c.duration_minutes} min</Text>
                </View>
                <TouchableOpacity onPress={() => deleteCollectif(c.id)}>
                  <Ionicons name="close" size={18} color={colors.destructive} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {tab === 'preferences' && (
        <ScrollView style={s.scroll}>
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('booking.prefsTitle')}</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>{t('booking.defaultDuration')}</Text>
                <TextInput style={s.input} value={String(prefs.default_duration || 60)} onChangeText={v => setPrefs({...prefs, default_duration: parseInt(v) || 60})} keyboardType="numeric" placeholderTextColor={colors.textTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>{t('booking.maxGroup')}</Text>
                <TextInput style={s.input} value={String(prefs.max_group_size || 4)} onChangeText={v => setPrefs({...prefs, max_group_size: parseInt(v) || 4})} keyboardType="numeric" placeholderTextColor={colors.textTertiary} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>{t('booking.privatePrice')}</Text>
                <TextInput style={s.input} value={String(prefs.private_price || 120)} onChangeText={v => setPrefs({...prefs, private_price: parseInt(v) || 120})} keyboardType="numeric" placeholderTextColor={colors.textTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="people-outline" size={12} color={colors.textTertiary} />
                  <Text style={s.label}>{t('booking.groupPrice')}</Text>
                </View>
                <TextInput style={s.input} value={String(prefs.group_price || 25)} onChangeText={v => setPrefs({...prefs, group_price: parseInt(v) || 25})} keyboardType="numeric" placeholderTextColor={colors.textTertiary} />
              </View>
            </View>
            <View style={{ backgroundColor: colors.primaryLight, borderRadius: 12, padding: 14, marginTop: 12 }}>
              <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 22 }}>
                {"\u2022 Cours de "}<Text style={{ fontWeight: '700' }}>{prefs.default_duration || 60} min</Text>{"\n\u2022 Prive : "}<Text style={{ fontWeight: '700' }}>{prefs.private_price || 120}\u20AC</Text>{" \u00B7 Collectif : "}<Text style={{ fontWeight: '700' }}>{prefs.group_price || 25}\u20AC/eleve</Text>{"\n\u2022 Revenus collectif max : "}<Text style={{ fontWeight: '700' }}>{(prefs.group_price || 25) * (prefs.max_group_size || 4)}\u20AC</Text>
              </Text>
            </View>
            <AnimatedPressable style={[s.addBtn, { marginTop: 16 }]} onPress={savePrefs}>
              <Ionicons name="checkmark" size={16} color="#fff" />
              <Text style={s.addBtnTxt}> {t('booking.savePrefs')}</Text>
            </AnimatedPressable>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Add Lesson Modal */}
      <Modal visible={showAddLesson} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.card }}>
          <View style={s.modalHead}>
            <TouchableOpacity onPress={() => setShowAddLesson(false)}><Text style={s.backTxt}>{t('common.cancel')}</Text></TouchableOpacity>
            <Text style={s.modalTitle}>{t('booking.addLesson')}</Text>
            <View style={{ width: 60 }} />
          </View>
          <ScrollView style={{ padding: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 }}>
              <Ionicons name="calendar-outline" size={16} color={colors.textTertiary} />
              <Text style={{ fontSize: 14, color: colors.textTertiary }}>
                {selectedSlot?.date} a {selectedSlot?.time}
              </Text>
            </View>
            <Text style={s.label}>{t('booking.type')}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <TouchableOpacity onPress={() => setLessonType('private')} style={[s.chip, lessonType === 'private' && s.chipActive]}>
                <Text style={[s.chipTxt, lessonType === 'private' && { color: '#fff' }]}>{t('common.private')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setLessonType('group')} style={[s.chip, lessonType === 'group' && s.chipActive]}>
                <Ionicons name="people-outline" size={12} color={lessonType === 'group' ? '#fff' : colors.text} />
                <Text style={[s.chipTxt, lessonType === 'group' && { color: '#fff' }]}> {t('common.group')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setLessonType('event')} style={[s.chip, lessonType === 'event' && { backgroundColor: '#F59E0B', borderColor: '#F59E0B' }]}>
                <Ionicons name="pin-outline" size={12} color={lessonType === 'event' ? '#fff' : colors.text} />
                <Text style={[s.chipTxt, lessonType === 'event' && { color: '#fff' }]}> {t('booking.personalEvent')}</Text>
              </TouchableOpacity>
            </View>
            {lessonType === 'event' && (
              <View style={{ marginBottom: 16 }}>
                <Text style={s.label}>{t('booking.eventTitle')}</Text>
                <TextInput style={s.input} value={eventTitle} onChangeText={setEventTitle} placeholder={t('booking.eventPlaceholder')} placeholderTextColor={colors.textTertiary} />
              </View>
            )}
            {lessonType !== 'event' && <Text style={s.label}>{t('booking.student')}</Text>}
            {lessonType !== 'event' && players.map(p => (
              <TouchableOpacity key={p.id} onPress={() => setSelectedPlayer(p.id)} style={[s.playerRow, selectedPlayer === p.id && { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
                <View style={[s.playerAv, { backgroundColor: colors.primary }]}>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{p.full_name?.charAt(0)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{p.full_name}</Text>
                  <Text style={{ fontSize: 11, color: colors.textTertiary }}>HCP {p.current_handicap}</Text>
                </View>
                {selectedPlayer === p.id && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </TouchableOpacity>
            ))}
            <AnimatedPressable style={[s.addBtn, { marginTop: 24, marginBottom: 40 }, ((lessonType !== 'event' && !selectedPlayer) || savingLesson) && { opacity: 0.6 }]} onPress={addLesson} disabled={(lessonType !== 'event' && !selectedPlayer) || savingLesson}>
              <Text style={s.addBtnTxt}>{savingLesson ? t('booking.adding') : '+ ' + t('booking.confirmLesson')}</Text>
            </AnimatedPressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Slot Detail Modal */}
      <Modal visible={showSlotDetail} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.card }}>
          <View style={s.modalHead}>
            <TouchableOpacity onPress={() => setShowSlotDetail(false)}><Text style={s.backTxt}>{t('common.close')}</Text></TouchableOpacity>
            <Text style={s.modalTitle}>{slotDetail?.date} a {slotDetail?.time}</Text>
            <View style={{ width: 60 }} />
          </View>
          <ScrollView style={{ padding: 20 }}>
            {slotDetail?.collectif && (
              <View style={{ backgroundColor: '#EEF2FF', borderRadius: 14, padding: 16, marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="people-outline" size={16} color="#4F46E5" />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#4F46E5' }}>Cours collectif</Text>
                </View>
                <Text style={{ fontSize: 12, color: '#6366F1', marginTop: 4 }}>Max {slotDetail.collectif.max_players} eleves \u00B7 {slotDetail.collectif.duration_minutes} min \u00B7 {prefs.group_price || 25}\u20AC/eleve</Text>
              </View>
            )}
            {slotDetail?.lessons?.length === 0 && (
              <Text style={{ color: colors.textTertiary, textAlign: 'center', marginTop: 20 }}>{t('booking.noLessonSlot')}</Text>
            )}
            {slotDetail?.lessons?.map(lesson => (
              <View key={lesson.id} style={{ backgroundColor: colors.primaryLight, borderRadius: 14, padding: 16, marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.primary }}>{lesson.players?.full_name || t('common.private')}</Text>
                    <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>HCP {lesson.players?.current_handicap} \u00B7 {lesson.duration || 60} min</Text>
                  </View>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.primary }}>{lesson.price}\u20AC</Text>
                </View>
                <TouchableOpacity onPress={() => deleteLesson(lesson.id)} style={{ marginTop: 10, alignSelf: 'flex-start', backgroundColor: colors.destructiveBg, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="close" size={14} color={colors.destructive} />
                  <Text style={{ color: colors.destructive, fontSize: 12, fontWeight: '600' }}>{t('common.delete')}</Text>
                </TouchableOpacity>
              </View>
            ))}
            {slotDetail && (
              <AnimatedPressable style={[s.addBtn, { marginTop: 16 }]} onPress={() => {
                setShowSlotDetail(false)
                setSelectedSlot({ date: slotDetail.date, time: slotDetail.time })
                setTimeout(() => setShowAddLesson(true), 300)
              }}>
                <Text style={s.addBtnTxt}>+ {t('booking.addStudentSlot')}</Text>
              </AnimatedPressable>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bgSecondary },
  loading: { flex: 1, backgroundColor: c.bgSecondary },
  header: { backgroundColor: c.card, padding: 16, paddingTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 0.5, borderBottomColor: c.separator },
  title: { fontSize: 22, fontWeight: '800', color: c.text },
  tabs: { flexDirection: 'row', backgroundColor: c.card, padding: 4, margin: 16, marginBottom: 4, borderRadius: 12, borderWidth: 0.5, borderColor: c.separator },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: c.primary },
  tabTxt: { fontSize: 12, fontWeight: '600', color: c.textTertiary },
  tabTxtActive: { color: '#fff' },
  scroll: { flex: 1 },
  section: { backgroundColor: c.card, borderRadius: 16, margin: 16, marginBottom: 8, padding: 16, borderWidth: 0.5, borderColor: c.separator },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: c.text, marginBottom: 4 },
  sectionSub: { fontSize: 11, color: c.textTertiary, marginBottom: 14 },
  label: { fontSize: 11, fontWeight: '600', color: c.textTertiary, marginBottom: 4, marginTop: 8 },
  input: { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10, padding: 12, fontSize: 14, color: c.text },
  chip: { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6, marginBottom: 6, flexDirection: 'row', alignItems: 'center' },
  chipActive: { backgroundColor: c.primary, borderColor: c.primary },
  chipTxt: { fontSize: 12, color: c.text, fontWeight: '500' },
  addBtn: { backgroundColor: c.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  addBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
  whChip: { backgroundColor: c.primaryLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginRight: 6 },
  whChipTxt: { fontSize: 12, color: c.primary, fontWeight: '500' },
  weekBtn: { padding: 4, flexDirection: 'row', alignItems: 'center' },
  weekBtnTxt: { fontSize: 13, color: c.primary, fontWeight: '600' },
  dayHeader: { width: 80, alignItems: 'center', padding: 8, borderRadius: 8, marginHorizontal: 2 },
  dayName: { fontSize: 10, fontWeight: '600', color: c.textTertiary },
  dayNum: { fontSize: 20, fontWeight: '800', color: c.text },
  slot: { width: 80, minHeight: 52, marginHorizontal: 2, borderRadius: 6, borderWidth: 0.5, borderColor: c.separatorLight, backgroundColor: c.card, justifyContent: 'center', alignItems: 'center', padding: 3, marginBottom: 2 },
  slotEmpty: { backgroundColor: c.bgSecondary, borderColor: c.separatorLight },
  lessonBlock: { width: '100%', borderRadius: 5, padding: 4 },
  lessonBlockPrivate: { backgroundColor: c.primaryLight },
  lessonBlockGroup: { backgroundColor: '#EEF2FF' },
  lessonTime: { fontSize: 10, fontWeight: '700', color: c.primary },
  lessonName: { fontSize: 9, color: c.textSecondary, fontWeight: '500' },
  lessonPrice: { fontSize: 9, color: c.primary, fontWeight: '600' },
  collectifBlock: { width: '100%', borderRadius: 5, padding: 4, backgroundColor: '#EEF2FF' },
  collectifTime: { fontSize: 10, fontWeight: '700', color: '#4F46E5' },
  collectifLabel: { fontSize: 9, color: '#6366F1' },
  collectifPrice: { fontSize: 9, color: '#4F46E5', fontWeight: '600' },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 0.5, borderBottomColor: c.separator },
  modalTitle: { fontSize: 16, fontWeight: '700', color: c.text },
  backTxt: { fontSize: 15, color: c.primary, fontWeight: '600' },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: c.separator, marginBottom: 8, backgroundColor: c.card },
  playerAv: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
})
