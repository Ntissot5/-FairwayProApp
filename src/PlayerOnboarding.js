import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'

const G = '#1B5E35'
const { width } = Dimensions.get('window')

const SLIDES = [
  {
    icon: 'flag-outline',
    title: 'Bienvenue sur FairwayPro',
    sub: 'Ton espace personnel pour progresser au golf avec ton coach.',
    color: '#1B5E35',
  },
  {
    icon: 'stats-chart-outline',
    title: 'Suis ta progression',
    sub: 'Ajoute tes rounds, suis ton handicap et analyse tes stats trou par trou.',
    color: '#0891B2',
  },
  {
    icon: 'clipboard-outline',
    title: "Ton plan d'entrainement",
    sub: "Ton coach t'assigne des exercices personnalises. Complete-les pour progresser.",
    color: '#7C3AED',
  },
  {
    icon: 'calendar-outline',
    title: 'Réserve tes cours',
    sub: "Consulte le calendrier de ton coach et reserve tes creneaux directement depuis l'app.",
    color: '#D97706',
  },
  {
    icon: 'chatbubbles-outline',
    title: 'Reste connecté',
    sub: 'Envoie des messages à ton coach, partage tes vidéos de swing et rejoins la communauté.',
    color: '#DC2626',
  },
]

export default function PlayerOnboarding({ playerName, onFinish }) {
  const [step, setStep] = useState(0)
  const slide = SLIDES[step]
  const isLast = step === SLIDES.length - 1

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: slide.color }]}>
      <View style={s.container}>
        {/* Skip */}
        {!isLast && (
          <TouchableOpacity onPress={onFinish} style={s.skipBtn}>
            <Text style={s.skipTxt}>Passer</Text>
          </TouchableOpacity>
        )}

        {/* Content */}
        <View style={s.content}>
          <Ionicons name={slide.icon} size={48} color={slide.color} />
          {step === 0 && playerName && (
            <Text style={s.welcome}>Salut {playerName} !</Text>
          )}
          <Text style={s.title}>{slide.title}</Text>
          <Text style={s.sub}>{slide.sub}</Text>
        </View>

        {/* Dots */}
        <View style={s.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[s.dot, i === step && s.dotActive]} />
          ))}
        </View>

        {/* Button */}
        <TouchableOpacity
          style={s.btn}
          onPress={() => isLast ? onFinish() : setStep(step + 1)}
        >
          <Text style={[s.btnTxt, { color: slide.color }]}>
            {isLast ? "Cest parti !" : "Suivant →"}
          </Text>
        </TouchableOpacity>
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
  icon: { fontSize: 80, marginBottom: 8 },
  welcome: { fontSize: 20, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', textAlign: 'center', lineHeight: 36 },
  sub: { fontSize: 16, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 26, paddingHorizontal: 16 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive: { width: 24, backgroundColor: '#fff' },
  btn: { backgroundColor: '#fff', borderRadius: 16, padding: 18, alignItems: 'center' },
  btnTxt: { fontSize: 17, fontWeight: '800' },
})
