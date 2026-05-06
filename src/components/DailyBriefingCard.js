import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../supabase'

const G = '#1B5E35'

export default forwardRef(function DailyBriefingCard({ userId }, ref) {
  const { t, i18n } = useTranslation()
  const [briefing, setBriefing] = useState(null)
  const [hidden, setHidden] = useState(true)

  useImperativeHandle(ref, () => fetchBriefing)

  useEffect(() => {
    fetchBriefing()
  }, [])

  const fetchBriefing = async () => {
    if (!userId) return

    const today = new Date().toISOString().split('T')[0]

    // Check dismissed flag
    const dismissed = await AsyncStorage.getItem(`@briefing_dismissed_${today}`)
    if (dismissed) { setHidden(true); return }

    // Check time window (5h - 14h local)
    const hour = new Date().getHours()
    if (hour < 5 || hour >= 14) { setHidden(true); return }

    const { data } = await supabase
      .from('daily_briefings')
      .select('*')
      .eq('coach_id', userId)
      .eq('briefing_date', today)
      .maybeSingle()

    if (data) {
      setBriefing(data)
      setHidden(false)
      // Mark opened_at if not already
      if (!data.opened_at) {
        await supabase
          .from('daily_briefings')
          .update({ opened_at: new Date().toISOString() })
          .eq('id', data.id)
      }
    } else {
      setHidden(true)
    }
  }

  const handleDismiss = async () => {
    const today = new Date().toISOString().split('T')[0]
    await AsyncStorage.setItem(`@briefing_dismissed_${today}`, 'true')
    setHidden(true)
    setBriefing(null)
  }

  if (hidden || !briefing) return null

  const cards = briefing.cards || {}
  const now = new Date()
  const dateStr = now.toLocaleDateString(i18n.language === 'fr' ? 'fr-FR' : 'en-US', {
    weekday: 'long', day: 'numeric', month: 'long'
  })

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.greeting}>{cards.greeting || t('briefing.greeting_morning')}</Text>
          <Text style={s.date}>{dateStr}</Text>
        </View>
        <TouchableOpacity onPress={handleDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel={t('briefing.dismiss')}>
          <Ionicons name="close" size={20} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      {/* Card 1 — Aujourd'hui */}
      {cards.card1_items && cards.card1_items.length > 0 && (
        <View style={[s.card, s.cardGreen]}>
          <Text style={s.cardTitle}>{cards.card1_title || t('briefing.date_today')}</Text>
          {cards.card1_items.map((item, i) => (
            <Text key={i} style={s.cardItem}>{item}</Text>
          ))}
        </View>
      )}

      {/* Card 2 — À noter (ambre, only if items) */}
      {cards.card2_items && cards.card2_items.length > 0 && (
        <View style={[s.card, s.cardAmber]}>
          <Text style={s.cardTitle}>{cards.card2_title}</Text>
          {cards.card2_items.map((item, i) => (
            <Text key={i} style={s.cardItem}>{item}</Text>
          ))}
        </View>
      )}

      {/* Card 3 — Suggestion */}
      {cards.card3_text && (
        <View style={[s.card, s.cardBlue]}>
          <Text style={s.cardTitle}>{cards.card3_title}</Text>
          <Text style={s.cardText}>{cards.card3_text}</Text>
        </View>
      )}
    </View>
  )
})

const s = StyleSheet.create({
  container: { marginTop: 12, marginHorizontal: 16, marginBottom: 8, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  greeting: { fontSize: 18, fontWeight: '600', color: '#1a1a1a' },
  date: { fontSize: 14, color: '#9CA3AF', marginTop: 2 },
  card: { borderRadius: 8, padding: 12, borderLeftWidth: 4 },
  cardGreen: { backgroundColor: '#F0FDF4', borderLeftColor: '#22C55E' },
  cardAmber: { backgroundColor: '#FFFBEB', borderLeftColor: '#F59E0B' },
  cardBlue: { backgroundColor: '#EFF6FF', borderLeftColor: '#3B82F6' },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#1a1a1a', marginBottom: 6 },
  cardItem: { fontSize: 14, color: '#374151', lineHeight: 22, paddingLeft: 4 },
  cardText: { fontSize: 15, color: '#374151', lineHeight: 22 },
})
