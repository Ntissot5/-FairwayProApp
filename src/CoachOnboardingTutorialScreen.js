import { useState, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { supabase } from './supabase'

const G = '#1B5E35'
const { width: SCREEN_W } = Dimensions.get('window')

const CARDS = [
  { icon: 'videocam-outline', color: G, bg: '#E8F5E9', titleKey: 'onboarding.tut_1_title', textKey: 'onboarding.tut_1_text' },
  { icon: 'sunny-outline', color: '#2563EB', bg: '#EFF6FF', titleKey: 'onboarding.tut_2_title', textKey: 'onboarding.tut_2_text' },
  { icon: 'card-outline', color: '#D97706', bg: '#FFFBEB', titleKey: 'onboarding.tut_3_title', textKey: 'onboarding.tut_3_text' },
]

export default function CoachOnboardingTutorialScreen({ route, navigation }) {
  const { t } = useTranslation()
  const { fullName, city, club, playerFirstName } = route.params || {}
  const [page, setPage] = useState(0)
  const [finishing, setFinishing] = useState(false)
  const scrollRef = useRef(null)

  const handleScroll = (e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W)
    setPage(idx)
  }

  const handleFinish = async () => {
    setFinishing(true)
    await supabase.auth.updateUser({
      data: {
        onboarded_at: new Date().toISOString(),
        full_name: fullName,
        city,
        club: club || null,
      }
    })
    setFinishing(false)
    navigation.reset({ index: 0, routes: [{ name: 'CoachTabs', params: { firstSession: true, playerFirstName } }] })
  }

  const isLast = page === CARDS.length - 1

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <View style={s.stepBadge}><Text style={s.stepTxt}>3/3</Text></View>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        style={s.pager}
      >
        {CARDS.map((card, i) => (
          <View key={i} style={[s.card, { width: SCREEN_W }]}>
            <View style={[s.cardIconWrap, { backgroundColor: card.bg }]}>
              <Ionicons name={card.icon} size={56} color={card.color} />
            </View>
            <View style={s.screenshotPlaceholder}>
              <Text style={s.screenshotTxt}>Screenshot</Text>
            </View>
            <Text style={s.cardTitle}>{t(card.titleKey)}</Text>
            <Text style={s.cardText}>{t(card.textKey)}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Dots */}
      <View style={s.dots}>
        {CARDS.map((_, i) => (
          <View key={i} style={[s.dot, i === page && s.dotActive]} />
        ))}
      </View>

      {/* CTA */}
      <View style={s.footer}>
        {isLast ? (
          <TouchableOpacity style={s.cta} onPress={handleFinish} disabled={finishing}>
            {finishing ? <ActivityIndicator color="#fff" /> : <Text style={s.ctaTxt}>{t('onboarding.start')}</Text>}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={s.cta} onPress={() => {
            scrollRef.current?.scrollTo({ x: (page + 1) * SCREEN_W, animated: true })
          }}>
            <Text style={s.ctaTxt}>{t('onboarding.next')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 24, paddingBottom: 0 },
  stepBadge: { backgroundColor: '#E8F5E9', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4, alignSelf: 'flex-start' },
  stepTxt: { fontSize: 13, fontWeight: '700', color: G },
  pager: { flex: 1 },
  card: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  cardIconWrap: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  screenshotPlaceholder: { width: SCREEN_W - 80, height: 180, backgroundColor: '#F8FAF8', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  screenshotTxt: { fontSize: 14, color: '#9CA3AF' },
  cardTitle: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', textAlign: 'center', letterSpacing: -0.5, marginBottom: 8 },
  cardText: { fontSize: 16, color: '#6B7280', textAlign: 'center', lineHeight: 24 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E5E7EB' },
  dotActive: { backgroundColor: G, width: 24 },
  footer: { padding: 24, paddingTop: 0 },
  cta: { backgroundColor: G, borderRadius: 14, paddingVertical: 18, alignItems: 'center' },
  ctaTxt: { color: '#fff', fontSize: 17, fontWeight: '700' },
})
