import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from './supabase'

const G = '#1B5E35'
const DAYS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']

export default function PlayerBookScreen() {
  const [workHours, setWorkHours] = useState([])
  const [collectifs, setCollectifs] = useState([])
  const [lessons, setLessons] = useState([])
  const [prefs, setPrefs] = useState({ private_price: 120, group_price: 25 })
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)
  const [playerId, setPlayerId] = useState(null)
  const [coachId, setCoachId] = useState(null)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: player } = await supabase.from('players').select('*').eq('player_user_id', user.id).single()
    if (player) {
      setPlayerId(player.id)
      setCoachId(player.coach_id)
      const { data: wh } = await supabase.from('work_hours').select('*').eq('coach_id', player.coach_id)
      const { data: col } = await supabase.from('availabilities').select('*').eq('coach_id', player.coach_id)
      const { data: l } = await supabase.from('lessons').select('*').eq('coach_id', player.coach_id)
      const { data: p } = await supabase.from('coach_preferences').select('*').eq('coach_id', player.coach_id).single()
      setWorkHours(wh || [])
      setCollectifs(col || [])
      setLessons(l || [])
      if (p) setPrefs(p)
    }
    setLoading(false)
  }

  const bookSlot = async (date, time, type) => {
    Alert.alert('Réserver', type === 'private' ? 'Cours privé à ' + time + ' — ' + prefs.private_price + '€ ?' : 'Cours collectif à ' + time + ' — ' + prefs.group_price + '€/élève ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Confirmer', onPress: async () => {
        await supabase.from('lesson_bookings').insert({ player_id: playerId, coach_id: coachId, lesson_date: date, start_time: time + ':00', type })
        Alert.alert('✓ Réservé!')
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
  const weekLabel = weekDates[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' — ' + weekDates[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

  const getCollectifsForDay = (date) => {
    const dow = date.getDay() === 0 ? 6 : date.getDay() - 1
    return collectifs.filter(c => c.day_of_week === dow)
  }

  if (loading) return <View style={s.loading}><ActivityIndicator color={G} size="large" /></View>

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Book a session</Text>
        <Text style={s.sub}>Choose your slot</Text>
      </View>
      <View style={s.section}>
        <Text style={s.sectionTitle}>Réserver une séance</Text>
        <Text style={s.sectionSub}>Choisissez un créneau disponible</Text>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 8 }}>
          <TouchableOpacity onPress={() => setWeekOffset(weekOffset - 1)} style={s.weekBtn}>
            <Text style={s.weekBtnTxt}>‹</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151" }}>{weekLabel}</Text>
          <TouchableOpacity onPress={() => setWeekOffset(weekOffset + 1)} style={s.weekBtn}>
            <Text style={s.weekBtnTxt}>›</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <View>
            <View style={{ flexDirection: "row", marginBottom: 8 }}>
              <View style={{ width: 40 }} />
              {weekDates.map((d, i) => {
                const isToday = d.toDateString() === new Date().toDateString()
                return (
                  <View key={i} style={[s.dayHeader, isToday && { backgroundColor: G }]}>
                    <Text style={[s.dayName, isToday && { color: "#fff" }]}>{DAYS[i]}</Text>
                    <Text style={[s.dayNum, isToday && { color: "#fff" }]}>{d.getDate()}</Text>
                  </View>
                )
              })}
            </View>
            {["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"].map(time => (
              <View key={time} style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                <Text style={s.timeLabel}>{time}</Text>
                {weekDates.map((d, i) => {
                  const dow = d.getDay() === 0 ? 6 : d.getDay() - 1
                  const wh = workHours.find(w => w.day_of_week === dow)
                  const col = collectifs.find(c => c.day_of_week === dow && c.start_time?.startsWith(time.replace(':', '')))
                  const dateStr = d.toISOString().split('T')[0]
                  const booked = lessons.find(l => l.lesson_date === dateStr && l.start_time?.startsWith(time))
                  const isPast = d < new Date()

                  if (col) return (
                    <TouchableOpacity key={i} onPress={() => !isPast && bookSlot(dateStr, time, 'group')} style={s.collectifSlot}>
                      <Text style={s.collectifPrice}>{prefs.group_price}€</Text>
                      <Text style={s.collectifLabel}>{col.max_players} pl.</Text>
                    </TouchableOpacity>
                  )
                  if (booked) return <View key={i} style={s.bookedSlot}><Text style={s.bookedTxt}>✓</Text></View>
                  if (wh && !isPast) return (
                    <TouchableOpacity key={i} onPress={() => bookSlot(dateStr, time, 'private')} style={s.privateSlot}>
                      <Text style={s.privatePrice}>{prefs.private_price}€</Text>
                    </TouchableOpacity>
                  )
                  return <View key={i} style={s.emptySlot} />
                })}
              </View>
            ))}
          </View>
        </ScrollView>
        <View style={{ flexDirection: "row", gap: 16, padding: 16, paddingTop: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: "#fff", borderWidth: 1, borderColor: "#ccc" }} /><Text style={{ fontSize: 11, color: "#6B7280" }}>Individuel</Text></View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: "#EEF2FF" }} /><Text style={{ fontSize: 11, color: "#6B7280" }}>Collectif</Text></View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: "#E8F5EE" }} /><Text style={{ fontSize: 11, color: "#6B7280" }}>Déjà réservé</Text></View>
        </View>
      </View>
      <View style={{ height: 40 }} />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8f8f8" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { backgroundColor: "#fff", padding: 16, paddingTop: 10, borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB" },
  title: { fontSize: 22, fontWeight: "800", color: "#1a1a1a" },
  sub: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  section: { backgroundColor: "#fff", borderRadius: 16, margin: 16, borderWidth: 0.5, borderColor: "#E5E7EB", overflow: "hidden", paddingTop: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#1a1a1a", paddingHorizontal: 16, marginBottom: 2 },
  sectionSub: { fontSize: 12, color: "#9CA3AF", paddingHorizontal: 16, marginBottom: 12 },
  weekBtn: { padding: 8 },
  weekBtnTxt: { fontSize: 20, color: G, fontWeight: "700" },
  dayHeader: { width: 52, alignItems: "center", padding: 6, borderRadius: 8, marginHorizontal: 2 },
  dayName: { fontSize: 10, fontWeight: "600", color: "#9CA3AF" },
  dayNum: { fontSize: 16, fontWeight: "800", color: "#1a1a1a" },
  timeLabel: { width: 40, fontSize: 10, color: "#9CA3AF", fontWeight: "500" },
  privateSlot: { width: 52, height: 36, marginHorizontal: 2, backgroundColor: "#fff", borderRadius: 6, borderWidth: 1, borderColor: "#E5E7EB", alignItems: "center", justifyContent: "center" },
  privatePrice: { fontSize: 11, fontWeight: "700", color: G },
  collectifSlot: { width: 52, height: 36, marginHorizontal: 2, backgroundColor: "#EEF2FF", borderRadius: 6, alignItems: "center", justifyContent: "center" },
  collectifPrice: { fontSize: 11, fontWeight: "700", color: "#4F46E5" },
  collectifLabel: { fontSize: 9, color: "#6366F1" },
  bookedSlot: { width: 52, height: 36, marginHorizontal: 2, backgroundColor: "#E8F5EE", borderRadius: 6, alignItems: "center", justifyContent: "center" },
  bookedTxt: { fontSize: 14, color: G, fontWeight: "700" },
  emptySlot: { width: 52, height: 36, marginHorizontal: 2 },
})
