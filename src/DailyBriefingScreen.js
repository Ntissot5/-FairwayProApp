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

export default function DailyBriefingScreen({ navigation }) {
  const { colors, isDark } = useTheme()
  const { t } = useTranslation()
  const s = useMemo(() => makeStyles(colors, isDark), [colors, isDark])
  const [briefing, setBriefing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { fetchBriefing() }, [])

  const fetchBriefing = async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('daily_briefings')
      .select('*')
      .eq('coach_id', user.id)
      .eq('briefing_date', today)
      .single()

    if (data) {
      setBriefing(data.cards)
      // Mark as opened
      if (!data.opened_at) {
        await supabase.from('daily_briefings').update({ opened_at: new Date().toISOString() }).eq('id', data.id)
      }
    }
    setLoading(false)
    setRefreshing(false)
  }

  const regenerate = async () => {
    setRefreshing(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await fetch('https://aqdifzgqfemfdcigxsgw.supabase.co/functions/v1/daily-briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coach_id: user.id }),
      })
      await fetchBriefing()
    } catch (e) {
      setRefreshing(false)
    }
  }

  if (loading) return <SafeAreaView style={s.safe}><DashboardSkeleton /></SafeAreaView>

  if (!briefing) return (
    <SafeAreaView style={s.safe}>
      <View style={s.emptyWrap}>
        <Ionicons name="sunny-outline" size={48} color={colors.separator} />
        <Text style={s.emptyTitle}>{t('home.goodMorning')}</Text>
        <Text style={s.emptySub}>Aucun briefing disponible pour aujourd'hui</Text>
        <AnimatedPressable style={s.generateBtn} onPress={regenerate} hapticStyle="medium">
          <Ionicons name="sparkles" size={18} color="#fff" />
          <Text style={s.generateBtnTxt}>Generer mon briefing</Text>
        </AnimatedPressable>
      </View>
    </SafeAreaView>
  )

  const today = new Date()
  const dateStr = today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={regenerate} tintColor={colors.primary} />}>
        {/* Header */}
        <View style={s.header}>
          <AnimatedPressable onPress={() => navigation.goBack()} haptic={false} style={s.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.primary} />
          </AnimatedPressable>
          <View style={{ flex: 1 }}>
            <Text style={s.greeting}>{briefing.greeting || t('home.goodMorning')}</Text>
            <Text style={s.date}>{dateStr}</Text>
          </View>
          <Ionicons name="sunny" size={24} color={colors.warning} />
        </View>

        {/* Card 1 — Aujourd'hui */}
        <AnimatedListItem index={0}>
          <View style={s.card}>
            <View style={s.cardHeader}>
              <View style={[s.cardIconWrap, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="calendar" size={20} color={colors.primary} />
              </View>
              <Text style={s.cardTitle}>{briefing.card1_title || "Aujourd'hui"}</Text>
            </View>
            {(briefing.card1_items || []).map((item: string, i: number) => (
              <View key={i} style={s.cardItem}>
                <Text style={s.cardDot}>●</Text>
                <Text style={s.cardItemText}>{item}</Text>
              </View>
            ))}
          </View>
        </AnimatedListItem>

        {/* Card 2 — À noter */}
        <AnimatedListItem index={1}>
          <View style={s.card}>
            <View style={s.cardHeader}>
              <View style={[s.cardIconWrap, { backgroundColor: colors.warningBg }]}>
                <Ionicons name="alert-circle-outline" size={20} color={colors.warning} />
              </View>
              <Text style={s.cardTitle}>{briefing.card2_title || 'A noter'}</Text>
            </View>
            {(briefing.card2_items || []).map((item: string, i: number) => (
              <View key={i} style={s.cardItem}>
                <Text style={[s.cardDot, { color: colors.warning }]}>●</Text>
                <Text style={s.cardItemText}>{item}</Text>
              </View>
            ))}
          </View>
        </AnimatedListItem>

        {/* Card 3 — Suggestion IA */}
        <AnimatedListItem index={2}>
          <View style={[s.card, s.cardSuggestion]}>
            <View style={s.cardHeader}>
              <View style={[s.cardIconWrap, { backgroundColor: isDark ? '#1B3A2A' : '#E8F5EE' }]}>
                <Ionicons name="sparkles" size={20} color={colors.primary} />
              </View>
              <Text style={s.cardTitle}>{briefing.card3_title || 'Suggestion'}</Text>
            </View>
            <Text style={s.suggestionText}>{briefing.card3_text}</Text>
          </View>
        </AnimatedListItem>

        {/* Pull to refresh hint */}
        <Text style={s.refreshHint}>Tirez vers le bas pour regenerer</Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (c: any, isDark: boolean) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bgSecondary },
  scroll: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20, gap: 12 },
  backBtn: { padding: 4 },
  greeting: { fontSize: 24, fontWeight: '700', color: c.text, letterSpacing: -0.3 },
  date: { fontSize: 13, color: c.textTertiary, marginTop: 2, textTransform: 'capitalize' },
  card: { backgroundColor: c.card, marginHorizontal: 20, borderRadius: 16, padding: 18, marginBottom: 12, ...c.shadow },
  cardSuggestion: { borderLeftWidth: 3, borderLeftColor: c.primary },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  cardIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 17, fontWeight: '600', color: c.text },
  cardItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6 },
  cardDot: { fontSize: 8, color: c.primary, marginTop: 5 },
  cardItemText: { fontSize: 15, color: c.text, lineHeight: 22, flex: 1 },
  suggestionText: { fontSize: 15, color: c.text, lineHeight: 24, fontStyle: 'italic' },
  refreshHint: { textAlign: 'center', fontSize: 12, color: c.textTertiary, marginTop: 8 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 },
  emptyTitle: { fontSize: 24, fontWeight: '700', color: c.text },
  emptySub: { fontSize: 14, color: c.textTertiary, textAlign: 'center' },
  generateBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.primary, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14, marginTop: 8 },
  generateBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
