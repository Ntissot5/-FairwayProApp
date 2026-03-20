import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Modal, TextInput, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from './supabase'

const G = '#1B5E35'
const DAYS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche']
const HOURS = Array.from({length: 24}, (_, i) => (i < 10 ? '0'+i : ''+i) + ':00')

export default function BookingScreen({ navigation }) {
  const [tab, setTab] = useState('horaires')
  const [workHours, setWorkHours] = useState([])
  const [collectifs, setCollectifs] = useState([])
  const [prefs, setPrefs] = useState({ default_duration: 60, max_group_size: 4, private_price: 120, group_price: 25 })
  const [lessons, setLessons] = useState([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState(null)
  const [weekOffset, setWeekOffset] = useState(0)

  const [newWH, setNewWH] = useState({ day_of_week: 0, start_time: '08:00', end_time: '12:00' })
  const [newCol, setNewCol] = useState({ day_of_week: 1, start_time: '17:00', duration_minutes: 60, max_players: 3 })

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user.id)
    const { data: wh } = await supabase.from('work_hours').select('*').eq('coach_id', user.id).order('day_of_week')
    const { data: col } = await supabase.from('availabilities').select('*').eq('coach_id', user.id).order('day_of_week')
    const { data: p } = await supabase.from('coach_preferences').select('*').eq('coach_id', user.id).single()
    const { data: l } = await supabase.from('lessons').select('*').eq('coach_id', user.id)
    setWorkHours(wh || [])
    setCollectifs(col || [])
    if (p) setPrefs(p)
    setLessons(l || [])
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
    const { data: existing } = await supabase.from('coach_preferences').select('id').eq('coach_id', userId).single()
    if (existing) {
      await supabase.from('coach_preferences').update({ ...prefs, coach_id: userId }).eq('coach_id', userId)
    } else {
      await supabase.from('coach_preferences').insert({ ...prefs, coach_id: userId })
    }
    Alert.alert('✓ Préférences sauvegardées')
    fetchAll()
  }

  const getWeekDates = () => {
    const now = new Date()
    const monday = new Date(now)
    monday.setDate(now.getDate() - now.getDay() + 1 + weekOffset * 7)
    return Array.from({length: 7}, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return d
    })
  }

  const weekDates = getWeekDates()
  const weekLabel = weekDates[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' — ' + weekDates[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

  const getLessonsForDay = (date) => {
    const dateStr = date.toISOString().split('T')[0]
    return lessons.filter(l => l.lesson_date === dateStr)
  }

  const getCollectifsForDay = (date) => {
    const dow = date.getDay() === 0 ? 6 : date.getDay() - 1
    return collectifs.filter(c => c.day_of_week === dow)
  }

  if (loading) return <View style={s.loading}><ActivityIndicator color={G} size="large" /></View>

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Booking</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TouchableOpacity style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: G, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 }} onPress={() => navigation.navigate('Sessions')}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: G }}>+ Session</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ backgroundColor: G, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 }} onPress={() => navigation.navigate('Players')}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: '#fff' }}>+ Player</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={s.tabs}>
        {['horaires','préférences','agenda'].map(t => (
          <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'horaires' && (
        <ScrollView style={s.scroll}>
          <View style={s.section}>
            <Text style={s.sectionTitle}>Mes horaires de travail</Text>
            <Text style={s.sectionSub}>Créneaux générés automatiquement</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Jour</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {DAYS.map((d, i) => (
                    <TouchableOpacity key={i} onPress={() => setNewWH({...newWH, day_of_week: i})} style={[s.chip, newWH.day_of_week === i && s.chipActive]}>
                      <Text style={[s.chipTxt, newWH.day_of_week === i && { color: '#fff' }]}>{d.slice(0,3)}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Début</Text>
                <TextInput style={s.input} value={newWH.start_time} onChangeText={v => setNewWH({...newWH, start_time: v})} placeholder="08:00" placeholderTextColor="#9CA3AF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Fin</Text>
                <TextInput style={s.input} value={newWH.end_time} onChangeText={v => setNewWH({...newWH, end_time: v})} placeholder="12:00" placeholderTextColor="#9CA3AF" />
              </View>
              <TouchableOpacity style={[s.addBtn, { alignSelf: 'flex-end' }]} onPress={addWorkHour}>
                <Text style={s.addBtnTxt}>+ Ajouter</Text>
              </TouchableOpacity>
            </View>
            {DAYS.map((day, i) => {
              const wh = workHours.filter(w => w.day_of_week === i)
              if (wh.length === 0) return null
              return (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ width: 72, fontSize: 13, color: '#374151', fontWeight: '500' }}>{day}</Text>
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
            <Text style={s.sectionTitle}>👥 Créneaux collectifs fixes</Text>
            <Text style={s.sectionSub}>Récurrents chaque semaine</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              <View style={{ width: '100%' }}>
                <Text style={s.label}>Jour</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {DAYS.map((d, i) => (
                    <TouchableOpacity key={i} onPress={() => setNewCol({...newCol, day_of_week: i})} style={[s.chip, newCol.day_of_week === i && s.chipActive]}>
                      <Text style={[s.chipTxt, newCol.day_of_week === i && { color: '#fff' }]}>{d.slice(0,3)}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Heure</Text>
                <TextInput style={s.input} value={newCol.start_time} onChangeText={v => setNewCol({...newCol, start_time: v})} placeholder="17:00" placeholderTextColor="#9CA3AF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Durée (min)</Text>
                <TextInput style={s.input} value={String(newCol.duration_minutes)} onChangeText={v => setNewCol({...newCol, duration_minutes: v})} keyboardType="numeric" placeholderTextColor="#9CA3AF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Max élèves</Text>
                <TextInput style={s.input} value={String(newCol.max_players)} onChangeText={v => setNewCol({...newCol, max_players: v})} keyboardType="numeric" placeholderTextColor="#9CA3AF" />
              </View>
            </View>
            <TouchableOpacity style={s.addBtn} onPress={addCollectif}>
              <Text style={s.addBtnTxt}>+ Ajouter</Text>
            </TouchableOpacity>
            {collectifs.map(c => (
              <View key={c.id} style={[s.whChip, { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 }]}>
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#3730A3' }}>{DAYS[c.day_of_week]} · {c.start_time?.slice(0,5)} — {new Date(new Date('1970-01-01T'+c.start_time).getTime() + c.duration_minutes*60000).toTimeString().slice(0,5)}</Text>
                  <Text style={{ fontSize: 11, color: '#6B7280' }}>max {c.max_players} élèves · {c.duration_minutes} min</Text>
                </View>
                <TouchableOpacity onPress={() => deleteCollectif(c.id)}>
                  <Text style={{ color: '#DC2626', fontSize: 16 }}>×</Text>
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
                <TextInput style={s.input} value={String(prefs.default_duration || 60)} onChangeText={v => setPrefs({...prefs, default_duration: parseInt(v) || 60})} keyboardType="numeric" placeholderTextColor="#9CA3AF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Max cours collectif</Text>
                <TextInput style={s.input} value={String(prefs.max_group_size || 4)} onChangeText={v => setPrefs({...prefs, max_group_size: parseInt(v) || 4})} keyboardType="numeric" placeholderTextColor="#9CA3AF" />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>💚 Cours privé (€)</Text>
                <TextInput style={s.input} value={String(prefs.private_price || 120)} onChangeText={v => setPrefs({...prefs, private_price: parseInt(v) || 120})} keyboardType="numeric" placeholderTextColor="#9CA3AF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>👥 Collectif/élève (€)</Text>
                <TextInput style={s.input} value={String(prefs.group_price || 25)} onChangeText={v => setPrefs({...prefs, group_price: parseInt(v) || 25})} keyboardType="numeric" placeholderTextColor="#9CA3AF" />
              </View>
            </View>
            <View style={{ backgroundColor: '#F0FAF4', borderRadius: 12, padding: 14, marginTop: 12 }}>
              <Text style={{ fontSize: 13, color: '#374151', lineHeight: 22 }}>
                {"• Cours de "}<Text style={{ fontWeight: '700' }}>{prefs.default_duration || 60} min</Text>{"\n"}
                {"• Privé : "}<Text style={{ fontWeight: '700' }}>{prefs.private_price || 120}€</Text>{" · Collectif : "}<Text style={{ fontWeight: '700' }}>{prefs.group_price || 25}€/élève</Text>{" (max "}{prefs.max_group_size || 4}{")\n"}
                {"• Revenus collectif max : "}<Text style={{ fontWeight: '700' }}>{(prefs.group_price || 25) * (prefs.max_group_size || 4)}€</Text>
              </Text>
            </View>
            <TouchableOpacity style={[s.addBtn, { marginTop: 16 }]} onPress={savePrefs}>
              <Text style={s.addBtnTxt}>✓ Sauvegarder</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {tab === 'agenda' && (
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
            <TouchableOpacity onPress={() => setWeekOffset(weekOffset - 1)} style={s.weekBtn}>
              <Text style={s.weekBtnTxt}>‹ Préc.</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }}>{weekLabel}</Text>
            <TouchableOpacity onPress={() => setWeekOffset(weekOffset + 1)} style={s.weekBtn}>
              <Text style={s.weekBtnTxt}>Suiv. ›</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row' }}>
              {weekDates.map((date, i) => {
                const dayLessons = getLessonsForDay(date)
                const dayCollectifs = getCollectifsForDay(date)
                const isToday = date.toDateString() === new Date().toDateString()
                return (
                  <View key={i} style={{ width: 120, borderRightWidth: 0.5, borderRightColor: '#F0F4F0' }}>
                    <View style={[s.dayHeader, isToday && { backgroundColor: G }]}>
                      <Text style={[s.dayName, isToday && { color: '#fff' }]}>{DAYS[i].slice(0,3)}</Text>
                      <Text style={[s.dayNum, isToday && { color: '#fff' }]}>{date.getDate()}</Text>
                    </View>
                    <ScrollView style={{ height: 400 }}>
                      {dayCollectifs.map(c => (
                        <View key={c.id} style={s.collectifSlot}>
                          <Text style={s.collectifTime}>{c.start_time?.slice(0,5)}</Text>
                          <Text style={s.collectifLabel}>Collectif · max {c.max_players}</Text>
                          <Text style={s.collectifPrice}>{c.price || (c.max_players * (prefs.group_price || 25))}€/élève</Text>
                        </View>
                      ))}
                      {dayLessons.map(l => (
                        <View key={l.id} style={s.lessonSlot}>
                          <Text style={s.lessonTime}>{l.start_time?.slice(0,5)}</Text>
                          <Text style={s.lessonLabel}>Cours privé</Text>
                          <Text style={s.lessonPrice}>{prefs.private_price || 120}€</Text>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )
              })}
            </View>
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f8f8' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { backgroundColor: '#fff', padding: 16, paddingTop: 10, borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', letterSpacing: -0.5 },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', padding: 4, margin: 16, marginBottom: 8, borderRadius: 12, borderWidth: 0.5, borderColor: '#E5E7EB' },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: G },
  tabTxt: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  tabTxtActive: { color: '#fff' },
  scroll: { flex: 1 },
  section: { backgroundColor: '#fff', borderRadius: 16, margin: 16, marginBottom: 8, padding: 16, borderWidth: 0.5, borderColor: '#E5E7EB' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  sectionSub: { fontSize: 11, color: '#9CA3AF', marginBottom: 14 },
  label: { fontSize: 11, fontWeight: '600', color: '#6B7280', marginBottom: 4, marginTop: 8 },
  input: { backgroundColor: '#F8FAF8', borderWidth: 1, borderColor: '#E0E5E0', borderRadius: 10, padding: 12, fontSize: 14, color: '#1a1a1a' },
  chip: { backgroundColor: '#F8FAF8', borderWidth: 1, borderColor: '#E0E5E0', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6, marginBottom: 6 },
  chipActive: { backgroundColor: G, borderColor: G },
  chipTxt: { fontSize: 12, color: '#1a1a1a', fontWeight: '500' },
  addBtn: { backgroundColor: G, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center' },
  addBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
  whChip: { backgroundColor: '#E8F5EE', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginRight: 6 },
  whChipTxt: { fontSize: 12, color: G, fontWeight: '500' },
  weekBtn: { padding: 8 },
  weekBtnTxt: { fontSize: 13, color: G, fontWeight: '600' },
  dayHeader: { padding: 8, alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB', backgroundColor: '#fff' },
  dayName: { fontSize: 10, fontWeight: '600', color: '#9CA3AF' },
  dayNum: { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },
  collectifSlot: { margin: 4, padding: 8, backgroundColor: '#EEF2FF', borderRadius: 8, borderLeftWidth: 3, borderLeftColor: '#6366F1' },
  collectifTime: { fontSize: 12, fontWeight: '700', color: '#4F46E5' },
  collectifLabel: { fontSize: 10, color: '#6366F1' },
  collectifPrice: { fontSize: 10, color: '#4F46E5', fontWeight: '600' },
  lessonSlot: { margin: 4, padding: 8, backgroundColor: '#E8F5EE', borderRadius: 8, borderLeftWidth: 3, borderLeftColor: G },
  lessonTime: { fontSize: 12, fontWeight: '700', color: G },
  lessonLabel: { fontSize: 10, color: G },
  lessonPrice: { fontSize: 10, color: G, fontWeight: '600' },
})
