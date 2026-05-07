import { createContext, useContext, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { colors } from './theme'

const OnboardingContext = createContext(null)

export const STEPS = [
  { id: 'home', screen: 'Home', message: 'Bienvenue ! Voici ton tableau de bord. Tu peux voir ton HCP, tes rounds et les messages de ton coach.', position: 'bottom' },
  { id: 'add_round', screen: 'Home', message: 'Appuie sur ce bouton pour ajouter ton premier round de golf !', position: 'top' },
  { id: 'rounds', screen: 'PlayerRounds', message: 'Ici tu peux voir tous tes rounds et tes stats. Choisis Quick mode pour entrer un score rapidement.', position: 'bottom' },
  { id: "plan", screen: "PlayerPlan", message: "Ton coach t'assigne des exercices ici. Coche-les quand tu les as faits !", position: "bottom" },
  { id: 'book', screen: 'PlayerBook', message: 'Reserve tes cours directement dans le calendrier de ton coach. Appuie sur un creneau vert !', position: 'bottom' },
  { id: 'chat', screen: 'PlayerChat', message: 'Envoie des messages a ton coach a tout moment depuis ici.', position: 'bottom' },
  { id: 'done', screen: null, message: 'Tu es pret ! Bonne session de golf ! ', position: 'bottom' },
]

export function OnboardingProvider({ children }) {
  const [stepIndex, setStepIndex] = useState(-1)
  const [active, setActive] = useState(false)

  const start = () => { setStepIndex(0); setActive(true) }
  const next = () => {
    if (stepIndex >= STEPS.length - 1) { setActive(false); setStepIndex(-1) }
    else setStepIndex(stepIndex + 1)
  }
  const skip = () => { setActive(false); setStepIndex(-1) }
  const currentStep = active && stepIndex >= 0 ? STEPS[stepIndex] : null

  return (
    <OnboardingContext.Provider value={{ active, currentStep, stepIndex, start, next, skip }}>
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboarding() {
  return useContext(OnboardingContext)
}

export function OnboardingTooltip({ stepId, children, style }) {
  const { currentStep, next, skip } = useOnboarding()
  const isActive = currentStep?.id === stepId

  return (
    <View style={[style, { position: 'relative' }]}>
      {children}
      {isActive && (
        <View style={[s.tooltip, currentStep.position === 'top' ? s.tooltipTop : s.tooltipBottom]}>
          <View style={[s.arrow, currentStep.position === 'top' ? s.arrowBottom : s.arrowTop]} />
          <Text style={s.tooltipTxt}>{currentStep.message}</Text>
          <View style={s.tooltipBtns}>
            <TouchableOpacity onPress={skip} style={s.skipBtn}>
              <Text style={s.skipTxt}>Passer</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={next} style={s.nextBtn}>
              <Text style={s.nextTxt}>OK, suivant →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  tooltip: { position: 'absolute', left: 0, right: 0, backgroundColor: colors.primary, borderRadius: 16, padding: 16, zIndex: 9999, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 10 },
  tooltipBottom: { top: '100%', marginTop: 10 },
  tooltipTop: { bottom: '100%', marginBottom: 10 },
  arrow: { position: 'absolute', left: 20, width: 0, height: 0, borderLeftWidth: 8, borderRightWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  arrowTop: { top: -8, borderBottomWidth: 8, borderBottomColor: colors.primary },
  arrowBottom: { bottom: -8, borderTopWidth: 8, borderTopColor: colors.primary },
  tooltipTxt: { fontSize: 14, color: colors.textInverse, lineHeight: 22, marginBottom: 12 },
  tooltipBtns: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  skipBtn: { padding: 6 },
  skipTxt: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  nextBtn: { backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  nextTxt: { fontSize: 13, fontWeight: '700', color: colors.primary },
})
