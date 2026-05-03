import { View, Text, StyleSheet, ScrollView, Alert, Linking, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState, useEffect, useMemo } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { getProducts, purchase, restorePurchases } from './storekit'
import { useTheme } from './ThemeContext'
import { useTranslation } from 'react-i18next'
import AnimatedPressable from './components/AnimatedPressable'

const PRODUCT_IDS = ['fairwaypro.solo.monthly', 'fairwaypro.pro.monthly']

export default function SubscribeScreen({ navigation }) {
  const { colors } = useTheme()
  const { t } = useTranslation()
  const s = useMemo(() => makeStyles(colors), [colors])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState(false)

  const PLAN_INFO = {
    'fairwaypro.solo.monthly': { name: t('subscribe.solo'), desc: t('subscribe.soloDesc'), features: [t('subscribe.features.dashboard'), t('subscribe.features.aiReengagement'), t('subscribe.features.aiPlans'), t('subscribe.features.studentApp'), t('subscribe.features.booking')] },
    'fairwaypro.pro.monthly': { name: t('subscribe.pro'), desc: t('subscribe.proDesc'), pop: true, features: [t('subscribe.features.soloPlus'), t('subscribe.features.unlimited'), t('subscribe.features.unlimitedAI'), t('subscribe.features.videos'), t('subscribe.features.support'), t('subscribe.features.reports')] },
  }

  useEffect(() => {
    getProducts(PRODUCT_IDS).then(p => { setProducts(p); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const handleBuy = async (productId) => {
    setBuying(true)
    const result = await purchase(productId)
    setBuying(false)
    if (result && result.status === 'success') {
      Alert.alert(t('subscribe.thankyou'), t('subscribe.active'), [{ text: t('common.ok'), onPress: () => navigation.replace('Welcome') }])
    } else if (result && result.status === 'cancelled') {
    } else if (!result) {
      navigation.replace('Welcome')
    }
  }

  const handleRestore = async () => {
    setBuying(true)
    const active = await restorePurchases()
    setBuying(false)
    if (active && active.length > 0) {
      Alert.alert(t('subscribe.restored'), t('subscribe.active'), [{ text: t('common.ok'), onPress: () => navigation.replace('Welcome') }])
    } else {
      Alert.alert(t('subscribe.noSub'), t('subscribe.noSubMsg'))
    }
  }

  const displayPlans = products.length > 0
    ? products.map(p => ({ id: p.id, ...(PLAN_INFO[p.id] || {}), price: p.displayPrice, period: '/mo' }))
    : PRODUCT_IDS.map(id => ({ id, ...(PLAN_INFO[id] || {}), price: id.includes('solo') ? 'CHF 40' : 'CHF 60', period: '/mo' }))

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.logo}>Fairway<Text style={{ color: '#4ade80' }}>Pro</Text></Text>
        <Text style={s.title}>{t('subscribe.title')}</Text>
        <Text style={s.sub}>{t('subscribe.subtitle')}</Text>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          displayPlans.map(p => (
            <AnimatedPressable key={p.id} style={[s.card, p.pop && s.cardPop]} onPress={() => handleBuy(p.id)} disabled={buying} hapticStyle="medium">
              {p.pop && <View style={s.badge}><Text style={s.badgeTxt}>{t('subscribe.popular')}</Text></View>}
              <Text style={s.planName}>{p.name}</Text>
              <Text style={s.planDesc}>{p.desc}</Text>
              <Text style={s.price}>{p.price}<Text style={s.period}>{p.period}</Text></Text>
              <View style={s.div} />
              {(p.features || []).map(f => (
                <View key={f} style={s.fRow}>
                  <Ionicons name="checkmark" size={16} color={colors.primary} />
                  <Text style={s.fTxt}>{f}</Text>
                </View>
              ))}
              <View style={[s.btn, p.pop && { backgroundColor: colors.primary }]}>
                <Text style={[s.btnTxt, p.pop && { color: '#fff' }]}>{buying ? t('subscribe.processing') : t('subscribe.startTrial')}</Text>
              </View>
            </AnimatedPressable>
          ))
        )}

        <AnimatedPressable onPress={handleRestore} disabled={buying} style={{ marginTop: 24, alignItems: 'center' }} haptic={false}>
          <Text style={s.restore}>{t('subscribe.restore')}</Text>
        </AnimatedPressable>

        <AnimatedPressable onPress={() => navigation.replace('Welcome')} style={{ marginTop: 16, alignItems: 'center' }} haptic={false}>
          <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '500' }}>{t('subscribe.signin')}</Text>
        </AnimatedPressable>

        <View style={{ marginTop: 32, flexDirection: 'row', justifyContent: 'center', gap: 20 }}>
          <AnimatedPressable onPress={() => Linking.openURL('https://www.fairwaypro.io/terms')} haptic={false}>
            <Text style={{ fontSize: 12, color: colors.primary, textDecorationLine: 'underline' }}>{t('subscribe.terms')}</Text>
          </AnimatedPressable>
          <AnimatedPressable onPress={() => Linking.openURL('https://www.fairwaypro.io/privacy')} haptic={false}>
            <Text style={{ fontSize: 12, color: colors.primary, textDecorationLine: 'underline' }}>{t('subscribe.privacy')}</Text>
          </AnimatedPressable>
        </View>

        <Text style={s.legal}>{t('subscribe.legal')}</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bgSecondary },
  scroll: { padding: 24, paddingTop: 48, paddingBottom: 60 },
  logo: { fontSize: 28, fontWeight: '900', color: c.primary, letterSpacing: -1, textAlign: 'center', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '800', color: c.text, textAlign: 'center' },
  sub: { fontSize: 14, color: c.textTertiary, textAlign: 'center', marginTop: 8, marginBottom: 28 },
  card: { backgroundColor: c.card, borderWidth: 1, borderColor: c.separator, borderTopWidth: 3, borderTopColor: c.primary, borderRadius: 16, padding: 22, marginBottom: 16, position: 'relative', ...c.shadow },
  cardPop: { borderColor: c.primary, borderWidth: 1.5 },
  badge: { position: 'absolute', top: -1, right: 16, backgroundColor: c.primary, paddingHorizontal: 12, paddingVertical: 4, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 },
  badgeTxt: { fontSize: 9, fontWeight: '700', color: '#fff' },
  planName: { fontSize: 20, fontWeight: '800', color: c.text, marginTop: 4 },
  planDesc: { fontSize: 12, color: c.textTertiary, marginBottom: 14 },
  price: { fontSize: 38, fontWeight: '900', letterSpacing: -1.5, color: c.primary },
  period: { fontSize: 14, color: c.textTertiary, fontWeight: '400' },
  div: { height: 1, backgroundColor: c.separatorLight, marginVertical: 16 },
  fRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  fTxt: { fontSize: 13, color: c.textSecondary },
  btn: { backgroundColor: c.primaryLight, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 16 },
  btnTxt: { fontSize: 15, fontWeight: '600', color: c.primary },
  restore: { fontSize: 13, color: c.textTertiary, textDecorationLine: 'underline' },
  legal: { fontSize: 10, color: c.textTertiary, textAlign: 'center', marginTop: 24, lineHeight: 16 },
})
