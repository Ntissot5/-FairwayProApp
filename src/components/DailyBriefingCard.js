import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../supabase'
import { isBriefingActive } from '../utils/briefingSettings'
import { colors } from '../theme'

// TODO: dismissed flag clears tomorrow automatically (date-based key)

export default forwardRef(function DailyBriefingCard({ userId }, ref) {
  const { t, i18n } = useTranslation()
  const [briefing, setBriefing] = useState(null)
  const [isDismissed, setIsDismissed] = useState(false)

  useImperativeHandle(ref, () => fetchBriefing)

  useEffect(() => {
    if (__DEV__) {
      const today = new Date().toISOString().split('T')[0]
      AsyncStorage.removeItem(`@briefing_dismissed_${today}`)
    }
    fetchBriefing()
  }, [])

  const fetchBriefing = async () => {
    if (!userId) return

    // Check settings (enabled + not paused)
    const active = await isBriefingActive()
    if (!active) { setBriefing(null); return }

    // Check time window (5h - 14h local)
    const hour = new Date().getHours()
    if (!__DEV__ && (hour < 5 || hour >= 14)) { setBriefing(null); return }

    const today = new Date().toISOString().split('T')[0]

    const { data } = await supabase
      .from('daily_briefings')
      .select('*')
      .eq('coach_id', userId)
      .eq('briefing_date', today)
      .maybeSingle()

    if (data) {
      setBriefing(data)
      // Check dismissed flag
      const dismissed = await AsyncStorage.getItem(`@briefing_dismissed_${today}`)
      setIsDismissed(!!dismissed)
      // Mark opened_at if not already
      if (!data.opened_at) {
        await supabase
          .from('daily_briefings')
          .update({ opened_at: new Date().toISOString() })
          .eq('id', data.id)
      }
    } else {
      setBriefing(null)
    }
  }

  const handleDismiss = async () => {
    const today = new Date().toISOString().split('T')[0]
    await AsyncStorage.setItem(`@briefing_dismissed_${today}`, 'true')
    setIsDismissed(true)
  }

  const handleReshow = async () => {
    const today = new Date().toISOString().split('T')[0]
    await AsyncStorage.removeItem(`@briefing_dismissed_${today}`)
    setIsDismissed(false)
  }

  // Nothing to show
  if (!briefing) return null

  // Dismissed state — show pill
  if (isDismissed) {
    return (
      <TouchableOpacity style={s.pill} onPress={handleReshow}>
        <Ionicons name="sunny-outline" size={16} color="#22C55E" />
        <Text style={s.pillText}>{t('briefing.show_again')}</Text>
      </TouchableOpacity>
    )
  }

  // Full briefing
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
          <Ionicons name="close" size={20} color={colors.textTertiary} />
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
  greeting: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  date: { fontSize: 14, color: colors.textTertiary, marginTop: 2 },
  card: { borderRadius: 8, padding: 12, borderLeftWidth: 4 },
  cardGreen: { backgroundColor: '#F0FDF4', borderLeftColor: '#22C55E' },
  cardAmber: { backgroundColor: '#FFFBEB', borderLeftColor: colors.warning },
  cardBlue: { backgroundColor: '#EFF6FF', borderLeftColor: '#3B82F6' },
  cardTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 },
  cardItem: { fontSize: 14, color: colors.textSecondary, lineHeight: 22, paddingLeft: 4 },
  cardText: { fontSize: 15, color: colors.textSecondary, lineHeight: 22 },
  pill: { alignSelf: 'flex-end', marginRight: 16, marginTop: 8, backgroundColor: '#F0FDF4', borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  pillText: { fontSize: 12, fontWeight: '500', color: '#22C55E' },
})
