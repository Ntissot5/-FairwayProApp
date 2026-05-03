import { useState, useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import AnimatedPressable from './components/AnimatedPressable'

export default function PlayerOnboarding({ playerName, onFinish }) {
  const { t } = useTranslation()
  const [step, setStep] = useState(0)

  const SLIDES = [
    { icon: 'flag', title: t('onboarding.welcome'), sub: t('onboarding.welcomeSub'), color: '#1B5E35' },
    { icon: 'bar-chart-outline', title: t('onboarding.progress'), sub: t('onboarding.progressSub'), color: '#0891B2' },
    { icon: 'clipboard-outline', title: t('onboarding.training'), sub: t('onboarding.trainingSub'), color: '#7C3AED' },
    { icon: 'calendar-outline', title: t('onboarding.booking'), sub: t('onboarding.bookingSub'), color: '#D97706' },
    { icon: 'chatbubble-outline', title: t('onboarding.connected'), sub: t('onboarding.connectedSub'), color: '#DC2626' },
  ]

  const slide = SLIDES[step]
  const isLast = step === SLIDES.length - 1

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: slide.color }]}>
      <View style={s.container}>
        {!isLast && (
          <AnimatedPressable onPress={onFinish} style={s.skipBtn} haptic={false}>
            <Text style={s.skipTxt}>{t('onboarding.skip')}</Text>
          </AnimatedPressable>
        )}
        <View style={s.content}>
          <View style={s.iconWrap}>
            <Ionicons name={slide.icon} size={60} color="#fff" />
          </View>
          {step === 0 && playerName && (
            <Text style={s.welcome}>{t('onboarding.hello', { name: playerName })}</Text>
          )}
          <Text style={s.title}>{slide.title}</Text>
          <Text style={s.sub}>{slide.sub}</Text>
        </View>
        <View style={s.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[s.dot, i === step && s.dotActive]} />
          ))}
        </View>
        <AnimatedPressable style={s.btn} onPress={() => isLast ? onFinish() : setStep(step + 1)} hapticStyle="medium">
          <Text style={[s.btnTxt, { color: slide.color }]}>
            {isLast ? t('onboarding.letsGo') : t('common.next')}
          </Text>
          {!isLast && <Ionicons name="arrow-forward" size={18} color={slide.color} />}
        </AnimatedPressable>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, padding: 24, justifyContent: 'space-between' },
  skipBtn: { alignSelf: 'flex-end', padding: 8 },
  skipTxt: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  iconWrap: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  welcome: { fontSize: 20, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', textAlign: 'center', lineHeight: 36 },
  sub: { fontSize: 16, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 26, paddingHorizontal: 16 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive: { width: 24, backgroundColor: '#fff' },
  btn: { backgroundColor: '#fff', borderRadius: 16, padding: 18, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  btnTxt: { fontSize: 17, fontWeight: '800' },
})
