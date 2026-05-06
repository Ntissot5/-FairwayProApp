import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { supabase } from './supabase'

const G = '#1B5E35'

export default function PlayerSessionSummaryScreen({ route, navigation }) {
  const { t, i18n } = useTranslation()
  const { session_record_id } = route.params || {}
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [thanked, setThanked] = useState(false)

  useEffect(() => {
    fetchRecord()
  }, [])

  const fetchRecord = async () => {
    const { data } = await supabase
      .from('session_records')
      .select('*')
      .eq('id', session_record_id)
      .single()

    if (data) {
      setRecord(data)
      // Mark opened_at
      if (!data.opened_at) {
        await supabase
          .from('session_records')
          .update({ opened_at: new Date().toISOString() })
          .eq('id', session_record_id)
      }
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color={G} />
        </View>
      </SafeAreaView>
    )
  }

  if (!record) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.loadingContainer}>
          <Text style={{ color: '#6B7280' }}>Not found</Text>
        </View>
      </SafeAreaView>
    )
  }

  const summary = record.ai_summary || {}
  const durationMin = record.duration_seconds ? Math.round(record.duration_seconds / 60) : 0
  const dateStr = record.sent_at
    ? new Date(record.sent_at).toLocaleDateString(i18n.language === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })
    : ''

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={G} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>{t('player_session_summary.title', { date: dateStr })}</Text>
          <Text style={s.headerSub}>{durationMin} min</Text>
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        {/* Worked on */}
        <View style={[s.card, s.cardGreen]}>
          <Text style={s.sectionLabel}>{t('session_summary.section_worked_on')}</Text>
          <Text style={s.paragraph}>{summary.worked_on}</Text>
        </View>

        {/* Strengths */}
        {summary.strengths?.length > 0 && (
          <View style={[s.card, s.cardBlue]}>
            <Text style={s.sectionLabel}>{t('session_summary.section_strengths')}</Text>
            {summary.strengths.map((item, i) => (
              <View key={i} style={s.bulletRow}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#3B82F6" style={{ marginTop: 2 }} />
                <Text style={s.bulletText}>{item}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Improvements */}
        {summary.improvements?.length > 0 && (
          <View style={[s.card, s.cardAmber]}>
            <Text style={s.sectionLabel}>{t('session_summary.section_improvements')}</Text>
            {summary.improvements.map((item, i) => (
              <View key={i} style={s.bulletRow}>
                <Ionicons name="trending-up-outline" size={16} color="#F59E0B" style={{ marginTop: 2 }} />
                <Text style={s.bulletText}>{item}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Drills */}
        {summary.drills?.length > 0 && (
          <View style={[s.card, s.cardTeal]}>
            <Text style={s.sectionLabel}>{t('session_summary.section_drills')}</Text>
            {summary.drills.map((drill, i) => {
              const name = typeof drill === 'string' ? drill : drill?.name || ''
              const desc = typeof drill === 'string' ? '' : drill?.description || ''
              return (
                <View key={i} style={s.drillRow}>
                  <Ionicons name="flag-outline" size={16} color="#10B981" style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.drillName}>{name}</Text>
                    {desc ? <Text style={s.drillDesc}>{desc}</Text> : null}
                  </View>
                </View>
              )
            })}
          </View>
        )}

        {/* Coach message */}
        {summary.coach_message && (
          <View style={s.messageSection}>
            <Text style={s.messageText}>{summary.coach_message}</Text>
          </View>
        )}

        {/* Thanks button */}
        <TouchableOpacity
          style={[s.thanksBtn, thanked && s.thanksBtnDone]}
          onPress={() => setThanked(true)}
          disabled={thanked}
        >
          <Text style={[s.thanksBtnTxt, thanked && { color: G }]}>
            {thanked ? t('player_session_summary.thanks_sent') : t('player_session_summary.thanks_coach')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f8f8' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  headerSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32, gap: 12 },
  card: { borderRadius: 12, padding: 14, borderLeftWidth: 4 },
  cardGreen: { backgroundColor: '#F0FDF4', borderLeftColor: '#22C55E' },
  cardBlue: { backgroundColor: '#EFF6FF', borderLeftColor: '#3B82F6' },
  cardAmber: { backgroundColor: '#FFFBEB', borderLeftColor: '#F59E0B' },
  cardTeal: { backgroundColor: '#ECFDF5', borderLeftColor: '#10B981' },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#6B7280', letterSpacing: 0.5, marginBottom: 8 },
  paragraph: { fontSize: 15, color: '#1a1a1a', lineHeight: 22 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  bulletText: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 20 },
  drillRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  drillName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  drillDesc: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  messageSection: { paddingVertical: 8, paddingHorizontal: 4 },
  messageText: { fontSize: 15, color: '#374151', fontStyle: 'italic', textAlign: 'center', lineHeight: 22 },
  thanksBtn: { backgroundColor: G, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  thanksBtnDone: { backgroundColor: '#E8F5E9' },
  thanksBtnTxt: { fontSize: 16, fontWeight: '700', color: '#fff' },
})
