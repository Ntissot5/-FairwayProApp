import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Modal, TextInput, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from './supabase'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { colors } from './theme'

const DAYS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']
const HOURS = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00']

export default function BookingScreen({ navigation }) {
  const { t } = useTranslation()
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

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user.id)
    const { data: wh } = await supabase.from('work_hours').select('*').eq('coach_id', user.id).order('day_of_week')
    const { data: col } = await supabase.from('availabilities').select('*').eq('coach_id', user.id).order('day_of_week')
    const { data: p } = await supabase.from('coach_preferences').select('*').eq('coach_id', user.id).single()
    const { data: l } = await supabase.from('lessons').select('*, players(full_name, current_handicap)').eq('coach_id', user.id).gte('lesson_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
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
    Alert.alert(t('booking.preferences_saved'))
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
      // Also create a session for revenue tracking
      await supabase.from('sessions').insert({
        coach_id: userId,
        player_id: selectedPlayer,
        price: lessonType === 'private' ? (prefs.private_price || 120) : (prefs.group_price || 25),
        session_date: selectedSlot.date,
        notes: lessonType === 'group' ? t('booking.group') : t('booking.private'),
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
    Alert.alert('Supprimer ce cours ?', '', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
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
  const weekLabel = weekDates[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' — ' + weekDates[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

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
    if (wh.length === 0) return true // Show all slots if no work hours set
    return wh.some(w => {
      const start = (w.start_time || '').slice(0, 5)
      const end = (w.end_time || '').slice(0, 5)
      return time >= start && time < end
    })
  }

  if (loading) return <View style={s.loading}><ActivityIndicator color={colors.primary} size="large" /></View>

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>{t('booking.title')}</Text>

      </View>

      <View style={s.tabs}>
        {['agenda', 'horaires', 'préférences'].map(t => (
          <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'agenda' && (
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 }}>
            <TouchableOpacity onPress={() => setWeekOffset(weekOffset - 1)} style={s.weekBtn}>
              <Text style={s.weekBtnTxt}>‹ {t('booking.previous')}</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>{weekLabel}</Text>
            <TouchableOpacity onPress={() => setWeekOffset(weekOffset + 1)} style={s.weekBtn}>
              <Text style={s.weekBtnTxt}>{t('booking.next')} ›</Text>
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
                      <Text style={[s.dayName, isToday && { color: colors.textInverse }]}>{DAYS[i]}</Text>
                      <Text style={[s.dayNum, isToday && { color: colors.textInverse }]}>{date.getDate()}</Text>
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
                              <Text style={s.collectifLabel}>Collectif · max {col.max_players}</Text>
                              <Text style={s.collectifPrice}>{prefs.group_price || 25}€/él.</Text>
                            </View>
                          )}
                          {slotLessons.map((lesson, li) => (
                            <View key={li} style={[s.lessonBlock, lesson.is_private_event ? { backgroundColor: '#FEF3C7' } : lesson.is_group ? s.lessonBlockGroup : s.lessonBlockPrivate]}>
                              <Text style={[s.lessonTime, lesson.is_private_event && { color: colors.warning }]}>{time}</Text>
                              <Text style={s.lessonName} numberOfLines={1}>{lesson.is_private_event ? (lesson.title || t('booking.private')) : (lesson.players?.full_name || t('booking.private'))}</Text>
                              {!lesson.is_private_event && <Text style={s.lessonPrice}>{lesson.price}€</Text>}
                            </View>
                          ))}
                          {isWorking && slotLessons.length === 0 && !col && (
                            <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                              <Text style={{ fontSize: 18, color: '#D1D5DB', fontWeight: '300' }}>+</Text>
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: colors.primaryLight }} /><Text style={{ fontSize: 10, color: colors.textSecondary }}>Cours privé</Text></View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#EEF2FF' }} /><Text style={{ fontSize: 10, color: colors.textSecondary }}>Collectif</Text></View>
          </View>
        </View>
      )}

      {tab === 'horaires' && (
        <ScrollView style={s.scroll}>
          <View style={s.section}>
            <Text style={s.sectionTitle}>Mes horaires de travail</Text>
            <Text style={s.sectionSub}>Créneaux générés automatiquement</Text>
            <View style={{ marginBottom: 12 }}>
              <Text style={s.label}>Jour</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map((d, i) => (
                  <TouchableOpacity key={i} onPress={() => setNewWH({...newWH, day_of_week: i})} style={[s.chip, newWH.day_of_week === i && s.chipActive]}>
                    <Text style={[s.chipTxt, newWH.day_of_week === i && { color: colors.textInverse }]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Début</Text>
                  <TextInput style={s.input} value={newWH.start_time} onChangeText={v => setNewWH({...newWH, start_time: v})} placeholder="08:00" placeholderTextColor={colors.textTertiary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Fin</Text>
                  <TextInput style={s.input} value={newWH.end_time} onChangeText={v => setNewWH({...newWH, end_time: v})} placeholder="12:00" placeholderTextColor={colors.textTertiary} />
                </View>
                <TouchableOpacity style={[s.addBtn, { alignSelf: 'flex-end' }]} onPress={addWorkHour}>
                  <Text style={s.addBtnTxt}>+ Ajouter</Text>
                </TouchableOpacity>
              </View>
            </View>
            {['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map((day, i) => {
              const wh = workHours.filter(w => w.day_of_week === i)
              if (wh.length === 0) return null
              return (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ width: 36, fontSize: 12, color: colors.textSecondary, fontWeight: '600' }}>{day}</Text>
                  {wh.map(w => (
                    <TouchableOpacity key={w.id} onPress={() => deleteWorkHour(w.id)} style={s.whChip}>
                      <Text style={s.whChipTxt}>{w.start_time?.slice(0,5)} — {w.end_time?.slice(0,5)} ×</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )
            })}
          </View>

          <View style={s.section}>
            <Text style={s.sectionTitle}>Créneaux collectifs fixes</Text>
            <Text style={s.sectionSub}>Récurrents chaque semaine</Text>
            <Text style={s.label}>Jour</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map((d, i) => (
                <TouchableOpacity key={i} onPress={() => setNewCol({...newCol, day_of_week: i})} style={[s.chip, newCol.day_of_week === i && s.chipActive]}>
                  <Text style={[s.chipTxt, newCol.day_of_week === i && { color: colors.textInverse }]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Heure</Text>
                <TextInput style={s.input} value={newCol.start_time} onChangeText={v => setNewCol({...newCol, start_time: v})} placeholder="17:00" placeholderTextColor={colors.textTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Durée (min)</Text>
                <TextInput style={s.input} value={String(newCol.duration_minutes)} onChangeText={v => setNewCol({...newCol, duration_minutes: v})} keyboardType="numeric" placeholderTextColor={colors.textTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Max élèves</Text>
                <TextInput style={s.input} value={String(newCol.max_players)} onChangeText={v => setNewCol({...newCol, max_players: v})} keyboardType="numeric" placeholderTextColor={colors.textTertiary} />
              </View>
            </View>
            <TouchableOpacity style={[s.addBtn, { marginTop: 10 }]} onPress={addCollectif}>
              <Text style={s.addBtnTxt}>+ Ajouter</Text>
            </TouchableOpacity>
            {collectifs.map(c => (
              <View key={c.id} style={[s.whChip, { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 }]}>
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#3730A3' }}>
                    {['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'][c.day_of_week]} · {c.start_time?.slice(0,5)}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>max {c.max_players} élèves · {c.duration_minutes} min</Text>
                </View>
                <TouchableOpacity onPress={() => deleteCollectif(c.id)}>
                  <Text style={{ color: colors.error, fontSize: 16 }}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {tab === 'préférences' && (
        <ScrollView style={s.scroll}>
          <View style={s.section}>
            <Text style={s.sectionTitle}>Préférences de cours & tarifs</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Durée par défaut (min)</Text>
                <TextInput style={s.input} value={String(prefs.default_duration || 60)} onChangeText={v => setPrefs({...prefs, default_duration: parseInt(v) || 60})} keyboardType="numeric" placeholderTextColor={colors.textTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Max cours collectif</Text>
                <TextInput style={s.input} value={String(prefs.max_group_size || 4)} onChangeText={v => setPrefs({...prefs, max_group_size: parseInt(v) || 4})} keyboardType="numeric" placeholderTextColor={colors.textTertiary} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>💚 Cours privé (€)</Text>
                <TextInput style={s.input} value={String(prefs.private_price || 120)} onChangeText={v => setPrefs({...prefs, private_price: parseInt(v) || 120})} keyboardType="numeric" placeholderTextColor={colors.textTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Collectif/élève (€)</Text>
                <TextInput style={s.input} value={String(prefs.group_price || 25)} onChangeText={v => setPrefs({...prefs, group_price: parseInt(v) || 25})} keyboardType="numeric" placeholderTextColor={colors.textTertiary} />
              </View>
            </View>
            <View style={{ backgroundColor: colors.primaryLight, borderRadius: 12, padding: 14, marginTop: 12 }}>
              <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 22 }}>
                {"• Cours de "}<Text style={{ fontWeight: '700' }}>{prefs.default_duration || 60} min</Text>{"\n• Privé : "}<Text style={{ fontWeight: '700' }}>{prefs.private_price || 120}€</Text>{" · Collectif : "}<Text style={{ fontWeight: '700' }}>{prefs.group_price || 25}€/élève</Text>{"\n• Revenus collectif max : "}<Text style={{ fontWeight: '700' }}>{(prefs.group_price || 25) * (prefs.max_group_size || 4)}€</Text>
              </Text>
            </View>
            <TouchableOpacity style={[s.addBtn, { marginTop: 16 }]} onPress={savePrefs}>
              <Text style={s.addBtnTxt}>Sauvegarder</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Add Lesson Modal */}
      <Modal visible={showAddLesson} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={s.modalHead}>
            <TouchableOpacity onPress={() => setShowAddLesson(false)}><Text style={s.backTxt}>Annuler</Text></TouchableOpacity>
            <Text style={s.modalTitle}>Ajouter un cours</Text>
            <View style={{ width: 60 }} />
          </View>
          <ScrollView style={{ padding: 20 }}>
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 16 }}>
              {selectedSlot?.date} à {selectedSlot?.time}
            </Text>
            <Text style={s.label}>TYPE</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <TouchableOpacity onPress={() => setLessonType('private')} style={[s.chip, lessonType === 'private' && s.chipActive]}>
                <Text style={[s.chipTxt, lessonType === 'private' && { color: colors.textInverse }]}>💚 Cours privé</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setLessonType('group')} style={[s.chip, lessonType === 'group' && s.chipActive]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name="people-outline" size={14} color={lessonType === 'group' ? '#fff' : colors.textSecondary} /><Text style={[s.chipTxt, lessonType === 'group' && { color: colors.textInverse }]}>Collectif</Text></View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setLessonType('event')} style={[s.chip, lessonType === 'event' && { backgroundColor: colors.warning, borderColor: colors.warning }]}>
                <Text style={[s.chipTxt, lessonType === 'event' && { color: colors.textInverse }]}>📌 Événement perso</Text>
              </TouchableOpacity>
            </View>
            {lessonType === 'event' && (
              <View style={{ marginBottom: 16 }}>
                <Text style={s.label}>TITRE</Text>
                <TextInput style={s.input} value={eventTitle} onChangeText={setEventTitle} placeholder="Ex: Amener enfants à l'école" placeholderTextColor={colors.textTertiary} />
              </View>
            )}
            {lessonType !== 'event' && <Text style={s.label}>ÉLÈVE</Text>}
            {lessonType !== 'event' && players.map(p => (
              <TouchableOpacity key={p.id} onPress={() => setSelectedPlayer(p.id)} style={[s.playerRow, selectedPlayer === p.id && { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
                <View style={[s.playerAv, { backgroundColor: colors.primary }]}>
                  <Text style={{ color: colors.textInverse, fontSize: 14, fontWeight: '700' }}>{p.full_name?.charAt(0)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>{p.full_name}</Text>
                  <Text style={{ fontSize: 11, color: colors.textTertiary }}>HCP {p.current_handicap}</Text>
                </View>
                {selectedPlayer === p.id && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[s.addBtn, { marginTop: 24, marginBottom: 40 }, ((lessonType !== 'event' && !selectedPlayer) || savingLesson) && { opacity: 0.6 }]} onPress={addLesson} disabled={(lessonType !== 'event' && !selectedPlayer) || savingLesson}>
              <Text style={s.addBtnTxt}>{savingLesson ? 'Ajout...' : '+ Confirmer le cours'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Slot Detail Modal */}
      <Modal visible={showSlotDetail} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={s.modalHead}>
            <TouchableOpacity onPress={() => setShowSlotDetail(false)}><Text style={s.backTxt}>Fermer</Text></TouchableOpacity>
            <Text style={s.modalTitle}>{slotDetail?.date} à {slotDetail?.time}</Text>
            <View style={{ width: 60 }} />
          </View>
          <ScrollView style={{ padding: 20 }}>
            {slotDetail?.collectif && (
              <View style={{ backgroundColor: '#EEF2FF', borderRadius: 14, padding: 16, marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name="people-outline" size={14} color="#4F46E5" /><Text style={{ fontSize: 14, fontWeight: '700', color: '#4F46E5' }}>Cours collectif</Text></View>
                <Text style={{ fontSize: 12, color: '#6366F1', marginTop: 4 }}>Max {slotDetail.collectif.max_players} élèves · {slotDetail.collectif.duration_minutes} min · {prefs.group_price || 25}€/élève</Text>
              </View>
            )}
            {slotDetail?.lessons?.length === 0 && (
              <Text style={{ color: colors.textTertiary, textAlign: 'center', marginTop: 20 }}>Aucun cours sur ce créneau</Text>
            )}
            {slotDetail?.lessons?.map(lesson => (
              <View key={lesson.id} style={{ backgroundColor: colors.primaryLight, borderRadius: 14, padding: 16, marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.primary }}>{lesson.players?.full_name || t('booking.private')}</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>HCP {lesson.players?.current_handicap} · {lesson.duration || 60} min</Text>
                  </View>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.primary }}>{lesson.price}€</Text>
                </View>
                <TouchableOpacity onPress={() => deleteLesson(lesson.id)} style={{ marginTop: 10, alignSelf: 'flex-start', backgroundColor: colors.errorLight, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}>
                  <Text style={{ color: colors.error, fontSize: 12, fontWeight: '600' }}>✕ Supprimer</Text>
                </TouchableOpacity>
              </View>
            ))}
            {slotDetail && (
              <TouchableOpacity style={[s.addBtn, { marginTop: 16 }]} onPress={() => {
                setShowSlotDetail(false)
                setSelectedSlot({ date: slotDetail.date, time: slotDetail.time })
                setTimeout(() => setShowAddLesson(true), 300)
              }}>
                <Text style={s.addBtnTxt}>+ Ajouter un élève sur ce créneau</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surfaceElevated },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { backgroundColor: colors.surface, padding: 16, paddingTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 0.5, borderBottomColor: colors.borderStrong },
  title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  btn2: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  btn2Txt: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  tabs: { flexDirection: 'row', backgroundColor: colors.surface, padding: 4, margin: 16, marginBottom: 4, borderRadius: 12, borderWidth: 0.5, borderColor: colors.borderStrong },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: colors.primary },
  tabTxt: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  tabTxtActive: { color: colors.textInverse },
  scroll: { flex: 1 },
  section: { backgroundColor: colors.surface, borderRadius: 16, margin: 16, marginBottom: 8, padding: 16, borderWidth: 0.5, borderColor: colors.borderStrong },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  sectionSub: { fontSize: 11, color: colors.textTertiary, marginBottom: 14 },
  label: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, marginBottom: 4, marginTop: 8 },
  input: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 10, padding: 12, fontSize: 14, color: colors.textPrimary },
  chip: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6, marginBottom: 6 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { fontSize: 12, color: colors.textPrimary, fontWeight: '500' },
  addBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center' },
  addBtnTxt: { color: colors.textInverse, fontSize: 13, fontWeight: '700' },
  whChip: { backgroundColor: colors.primaryLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginRight: 6 },
  whChipTxt: { fontSize: 12, color: colors.primary, fontWeight: '500' },
  weekBtn: { padding: 4 },
  weekBtnTxt: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  dayHeader: { width: 80, alignItems: 'center', padding: 8, borderRadius: 8, marginHorizontal: 2 },
  dayName: { fontSize: 10, fontWeight: '600', color: colors.textTertiary },
  dayNum: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  slot: { width: 80, minHeight: 52, marginHorizontal: 2, borderRadius: 6, borderWidth: 0.5, borderColor: colors.border, backgroundColor: '#FAFFFE', justifyContent: 'center', alignItems: 'center', padding: 3, marginBottom: 2 },
  slotEmpty: { backgroundColor: colors.surfaceElevated, borderColor: '#F0F0F0' },
  addSlotTxt: { fontSize: 9, color: '#D1D5DB' },
  lessonBlock: { width: '100%', borderRadius: 5, padding: 4 },
  lessonBlockPrivate: { backgroundColor: colors.primaryLight },
  lessonBlockGroup: { backgroundColor: '#EEF2FF' },
  lessonTime: { fontSize: 10, fontWeight: '700', color: colors.primary },
  lessonName: { fontSize: 9, color: colors.textSecondary, fontWeight: '500' },
  lessonPrice: { fontSize: 9, color: colors.primary, fontWeight: '600' },
  collectifBlock: { width: '100%', borderRadius: 5, padding: 4, backgroundColor: '#EEF2FF' },
  collectifTime: { fontSize: 10, fontWeight: '700', color: '#4F46E5' },
  collectifLabel: { fontSize: 9, color: '#6366F1' },
  collectifPrice: { fontSize: 9, color: '#4F46E5', fontWeight: '600' },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 0.5, borderBottomColor: colors.borderStrong },
  modalTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  backTxt: { fontSize: 15, color: colors.primary, fontWeight: '600' },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.borderStrong, marginBottom: 8, backgroundColor: colors.surface },
  playerAv: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
})
