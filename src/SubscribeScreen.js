import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { colors } from './theme'

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
        <View style={s.betaBanner}>
          <Ionicons name="gift-outline" size={22} color={colors.primary} style={{ marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={s.betaTitle}>{t('plans.beta_banner_title')}</Text>
            <Text style={s.betaSubtitle}>{t('plans.beta_banner_subtitle')}</Text>
          </View>
        </View>
        {PLAN_KEYS.map((plan) => (
          <View key={plan.nameKey} style={[s.card, plan.badge && s.cardHighlight]}>
            <Text style={s.startingSept}>{t('plans.starting_september')}</Text>
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
                  <Ionicons name="checkmark" size={16} color={colors.primary} style={s.check} />
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
  safe: { flex: 1, backgroundColor: colors.surfaceElevated },
  header: { backgroundColor: colors.surface, padding: 20, paddingTop: 10, borderBottomWidth: 0.5, borderBottomColor: colors.borderStrong, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: colors.textTertiary, marginTop: 4 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: colors.borderStrong },
  cardHighlight: { borderColor: colors.primary, borderWidth: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  planName: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  badge: { backgroundColor: colors.primaryLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 16 },
  price: { fontSize: 28, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
  priceCurrency: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  features: { gap: 8 },
  featRow: { flexDirection: 'row', alignItems: 'center' },
  check: { marginRight: 10, width: 18 },
  featText: { fontSize: 14, color: colors.textSecondary },
  footer: { fontSize: 12, color: colors.textTertiary, textAlign: 'center', lineHeight: 18, marginTop: 20, paddingHorizontal: 16 },
  betaBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primaryLight, borderRadius: 12, padding: 16, marginBottom: 16 },
  betaTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  betaSubtitle: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  startingSept: { fontSize: 11, color: colors.textTertiary, fontWeight: '500', marginBottom: 8 },
})
