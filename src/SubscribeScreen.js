import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'

const G = '#1B5E35'

const PLAN_KEYS = [
  {
    nameKey: 'plans.solo',
    price: '39.99',
    badge: null,
    featureKeys: ['plans.feature_1_coach', 'plans.feature_30_students', 'plans.feature_daily_briefing', 'plans.feature_voice_notes'],
  },
  {
    nameKey: 'plans.pro',
    price: '59.99',
    badge: 'plans.popular',
    featureKeys: ['plans.feature_1_coach', 'plans.feature_unlimited_students', 'plans.feature_advanced_ai', 'plans.feature_full_analytics'],
  },
  {
    nameKey: 'plans.academy',
    price: '199.99',
    badge: null,
    featureKeys: ['plans.feature_multi_coach', 'plans.feature_director_mode', 'plans.feature_centralized_analytics', 'plans.feature_academy_management'],
  },
]

export default function SubscribeScreen({ navigation }) {
  const { t } = useTranslation()
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>{t('plans.title')}</Text>
        <Text style={s.subtitle}>{t('plans.subtitle')}</Text>
      </View>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        {PLAN_KEYS.map((plan) => (
          <View key={plan.nameKey} style={[s.card, plan.badge && s.cardHighlight]}>
            <View style={s.cardHeader}>
              <Text style={s.planName}>{t(plan.nameKey)}</Text>
              {plan.badge && (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{t(plan.badge)}</Text>
                </View>
              )}
            </View>
            <View style={s.priceRow}>
              <Text style={s.price}>{plan.price}</Text>
              <Text style={s.priceCurrency}> {t('plans.per_month')}</Text>
            </View>
            <View style={s.features}>
              {plan.featureKeys.map((key) => (
                <View key={key} style={s.featRow}>
                  <Ionicons name="checkmark" size={16} color={G} style={s.check} />
                  <Text style={s.featText}>{t(key)}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
        <Text style={s.footer}>{t('plans.footer')}</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f8f8' },
  header: { backgroundColor: '#fff', padding: 20, paddingTop: 10, borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: '#9CA3AF', marginTop: 4 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  cardHighlight: { borderColor: G, borderWidth: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  planName: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  badge: { backgroundColor: '#f0faf4', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700', color: G },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 16 },
  price: { fontSize: 28, fontWeight: '800', color: '#1a1a1a', letterSpacing: -0.5 },
  priceCurrency: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  features: { gap: 8 },
  featRow: { flexDirection: 'row', alignItems: 'center' },
  check: { marginRight: 10, width: 18 },
  featText: { fontSize: 14, color: '#374151' },
  footer: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', lineHeight: 18, marginTop: 20, paddingHorizontal: 16 },
})
