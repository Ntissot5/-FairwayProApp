import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const G = '#1B5E35'

const PLANS = [
  {
    name: 'Solo',
    price: '39.99',
    badge: null,
    features: [
      '1 coach',
      "Jusqu'à 30 élèves",
      'Briefing IA quotidien',
      'Notes vocales + résumé IA',
    ],
  },
  {
    name: 'Pro',
    price: '59.99',
    badge: 'Populaire',
    features: [
      '1 coach',
      'Élèves illimités',
      'IA avancée',
      'Analytics complets',
    ],
  },
  {
    name: 'Académie',
    price: '199.99',
    badge: null,
    features: [
      'Coachs multiples',
      'Mode directeur',
      'Analytics centralisés',
      'Gestion académie',
    ],
  },
]

export default function SubscribeScreen({ navigation }) {
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Plans FairwayPro</Text>
        <Text style={s.subtitle}>Outil professionnel pour coachs de golf</Text>
      </View>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        {PLANS.map((plan) => (
          <View key={plan.name} style={[s.card, plan.badge && s.cardHighlight]}>
            <View style={s.cardHeader}>
              <Text style={s.planName}>{plan.name}</Text>
              {plan.badge && (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{plan.badge}</Text>
                </View>
              )}
            </View>
            <View style={s.priceRow}>
              <Text style={s.price}>{plan.price}</Text>
              <Text style={s.priceCurrency}> CHF / mois</Text>
            </View>
            <View style={s.features}>
              {plan.features.map((feat) => (
                <View key={feat} style={s.featRow}>
                  <Text style={s.check}>✓</Text>
                  <Text style={s.featText}>{feat}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
        <Text style={s.footer}>
          FairwayPro est un outil B2B destiné aux coachs professionnels. Les comptes sont activés par notre équipe après inscription.
        </Text>
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
  check: { fontSize: 14, color: G, fontWeight: '700', marginRight: 10, width: 18 },
  featText: { fontSize: 14, color: '#374151' },
  footer: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', lineHeight: 18, marginTop: 20, paddingHorizontal: 16 },
})
