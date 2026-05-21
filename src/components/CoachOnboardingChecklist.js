import { useEffect, useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../supabase'
import { colors } from '../theme'

const STEP_DEFS = [
  { id: 'profile',  icon: 'person-circle-outline', title: 'Compléter mon profil',         desc: 'Ajoute ton nom et ton club',                             action: { tab: 'Settings' } },
  { id: 'hours',    icon: 'time-outline',          title: 'Définir mes disponibilités',   desc: 'Indique tes horaires pour la prise de RDV',              action: { tab: 'Booking', subTab: 'horaires' } },
  { id: 'student',  icon: 'person-add-outline',    title: 'Inviter mon premier élève',    desc: 'Ajoute un élève et envoie-lui son lien magique',         action: { tab: 'Players' } },
  { id: 'package',  icon: 'cube-outline',          title: 'Créer mon premier forfait',    desc: 'Propose un pack de leçons à tes élèves',                 action: { tab: 'Sessions', subTab: 'packages' } },
  { id: 'ai',       icon: 'sparkles-outline',      title: 'Générer mon premier plan IA',  desc: "Laisse l'IA créer un plan d'entraînement personnalisé", action: { tab: 'Sessions', subTab: 'sessions' } },
]

export default function CoachOnboardingChecklist({ user, players, packagesCount, workHoursCount, hasAIPlan, onNavigate, onUserUpdate, mode = 'card' }) {
  const meta = user?.user_metadata || {}
  const [started, setStarted] = useState(meta.onboarding_started === true)
  const [dismissed, setDismissed] = useState(meta.onboarding_dismissed === true)
  const [completed, setCompleted] = useState(meta.onboarding_completed === true)
  const [celebrating, setCelebrating] = useState(false)

  // Sync local state when the user prop changes (e.g. when the sibling instance
  // — card vs overlay — writes metadata and the parent refreshes the user).
  // Without this, useState's initial value sticks and the two instances drift.
  useEffect(() => {
    setStarted(meta.onboarding_started === true)
    setDismissed(meta.onboarding_dismissed === true)
    setCompleted(meta.onboarding_completed === true)
  }, [meta.onboarding_started, meta.onboarding_dismissed, meta.onboarding_completed])

  const profileDone = Boolean((meta.full_name || meta.name) && meta.club)

  const steps = useMemo(() => STEP_DEFS.map(def => {
    let done = false
    if (def.id === 'profile') done = profileDone
    else if (def.id === 'hours') done = workHoursCount > 0
    else if (def.id === 'student') done = (players?.length || 0) > 0
    else if (def.id === 'package') done = packagesCount > 0
    else if (def.id === 'ai') done = hasAIPlan
    return { ...def, done }
  }), [profileDone, workHoursCount, players?.length, packagesCount, hasAIPlan])

  const doneCount = steps.filter(s => s.done).length
  const totalCount = steps.length
  const progressPct = Math.round((doneCount / totalCount) * 100)
  const allDone = doneCount === totalCount

  const persist = async (patch) => {
    try {
      const { data } = await supabase.auth.updateUser({ data: patch })
      if (data?.user && onUserUpdate) onUserUpdate(data.user)
    } catch {}
  }

  useEffect(() => {
    if (!allDone || completed) return
    setCelebrating(true)
    supabase.auth.updateUser({ data: { onboarding_completed: true } })
      .then(({ data }) => {
        if (data?.user && onUserUpdate) onUserUpdate(data.user)
        setTimeout(() => setCompleted(true), 4000)
      })
      .catch(() => setCelebrating(false))
  }, [allDone, completed])

  const handleStart = () => { setStarted(true); persist({ onboarding_started: true }) }
  const handleDismissFromWelcome = () => { setStarted(true); setDismissed(true); persist({ onboarding_started: true, onboarding_dismissed: true }) }
  const handleDismiss = () => { setDismissed(true); persist({ onboarding_dismissed: true }) }
  const handleResume = () => { setDismissed(false); persist({ onboarding_dismissed: false }) }

  if (completed) return null

  // Overlay mode handles the welcome modal + floating pill (rendered at root, not in ScrollView)
  if (mode === 'overlay') {
    if (!started) return <WelcomeModal steps={steps} onStart={handleStart} onDismiss={handleDismissFromWelcome} />
    if (dismissed) {
      return (
        <TouchableOpacity onPress={handleResume} style={s.pill} activeOpacity={0.85}>
          <Ionicons name="sparkles" size={13} color={colors.textInverse} />
          <Text style={s.pillTxt}>Démarrage · {doneCount}/{totalCount}</Text>
        </TouchableOpacity>
      )
    }
    return null
  }

  // Card mode renders the inline checklist card (inside scroll view)
  if (!started || dismissed) return null

  const activeIdx = steps.findIndex(st => !st.done)

  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={s.headerIcon}><Ionicons name="sparkles" size={14} color={colors.primary} /></View>
          <Text style={s.cardTitle}>Démarrer en 10 minutes</Text>
          <View style={s.badge}><Text style={s.badgeTxt}>{doneCount}/{totalCount}</Text></View>
        </View>
        <TouchableOpacity onPress={handleDismiss} style={s.closeBtn}>
          <Ionicons name="close" size={16} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      <Text style={s.subtitle}>
        {allDone ? 'Bravo ! Ton académie est prête 🎉' : '5 étapes pour configurer ton compte et accueillir tes premiers élèves.'}
      </Text>

      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: `${progressPct}%` }]} />
      </View>
      <Text style={s.progressTxt}>
        {doneCount === 0 ? 'Commence par la première étape ↓' : `${doneCount} sur ${totalCount} complété${doneCount > 1 ? 's' : ''}`}
      </Text>

      <View style={{ marginTop: 8 }}>
        {steps.map((st, idx) => {
          const isActive = idx === activeIdx
          return (
            <View key={st.id} style={[s.stepRow, isActive && s.stepRowActive, st.done && { opacity: 0.65 }]}>
              <View style={[s.stepIcon, st.done ? s.stepIconDone : isActive ? s.stepIconActive : s.stepIconIdle]}>
                {st.done ? <Ionicons name="checkmark" size={16} color={colors.primary} /> : <Ionicons name={st.icon} size={16} color={isActive ? colors.primary : colors.textTertiary} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.stepTitle, st.done && { color: colors.textTertiary, textDecorationLine: 'line-through' }]}>{st.title}</Text>
                <Text style={s.stepDesc} numberOfLines={2}>{st.desc}</Text>
              </View>
              {st.done ? (
                <View style={s.doneBadge}>
                  <Ionicons name="checkmark" size={12} color={colors.primary} />
                  <Text style={s.doneBadgeTxt}>Fait</Text>
                </View>
              ) : isActive ? (
                <TouchableOpacity style={s.startBtn} onPress={() => onNavigate(st.action)} activeOpacity={0.85}>
                  <Text style={s.startBtnTxt}>Commencer</Text>
                  <Ionicons name="arrow-forward" size={13} color={colors.textInverse} />
                </TouchableOpacity>
              ) : null}
            </View>
          )
        })}
      </View>

      {celebrating && (
        <View style={s.celebrate}>
          <Text style={s.celebrateTxt}>🎉 Configuration terminée ! Ton académie est prête.</Text>
        </View>
      )}
    </View>
  )
}

function WelcomeModal({ steps, onStart, onDismiss }) {
  return (
    <Modal visible transparent animationType="fade">
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          <ScrollView contentContainerStyle={{ padding: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
              <View style={s.welcomeIcon}>
                <Ionicons name="sparkles" size={22} color={colors.textInverse} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.welcomeTitle}>Bienvenue sur FairwayPro 👋</Text>
                <Text style={s.welcomeSub}>Voici les 5 étapes pour démarrer en moins de 10 minutes.</Text>
              </View>
            </View>
            {steps.map((st, idx) => (
              <View key={st.id} style={s.welcomeStepRow}>
                <View style={s.welcomeStepNum}>
                  <Text style={s.welcomeStepNumTxt}>{idx + 1}</Text>
                </View>
                <Ionicons name={st.icon} size={16} color={colors.textTertiary} style={{ marginRight: 8 }} />
                <Text style={s.welcomeStepTxt}>{st.title}</Text>
              </View>
            ))}
            <TouchableOpacity style={s.welcomeCta} onPress={onStart} activeOpacity={0.85}>
              <Text style={s.welcomeCtaTxt}>Commencer</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.textInverse} />
            </TouchableOpacity>
            <TouchableOpacity style={{ marginTop: 12, alignItems: 'center' }} onPress={onDismiss}>
              <Text style={s.welcomeDismiss}>Plus tard</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.primary + '30', padding: 16, marginHorizontal: 16, marginBottom: 12, shadowColor: colors.primary, shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  headerIcon: { width: 26, height: 26, borderRadius: 8, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.2 },
  badge: { backgroundColor: colors.primaryLight, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeTxt: { fontSize: 11, fontWeight: '700', color: colors.primary },
  closeBtn: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  subtitle: { fontSize: 12, color: colors.textSecondary, marginBottom: 12, lineHeight: 16 },
  progressTrack: { height: 5, backgroundColor: colors.surfaceElevated, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 5, backgroundColor: colors.primary, borderRadius: 3 },
  progressTxt: { fontSize: 10, color: colors.textTertiary, fontWeight: '600', marginTop: 6 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 12 },
  stepRowActive: { backgroundColor: colors.primaryLight + '50' },
  stepIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepIconDone: { backgroundColor: colors.primaryLight },
  stepIconActive: { backgroundColor: colors.primaryLight },
  stepIconIdle: { backgroundColor: colors.surfaceElevated },
  stepTitle: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  stepDesc: { fontSize: 11, color: colors.textTertiary, marginTop: 2, lineHeight: 14 },
  doneBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.primaryLight, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  doneBadgeTxt: { fontSize: 11, fontWeight: '700', color: colors.primary },
  startBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  startBtnTxt: { fontSize: 11, fontWeight: '700', color: colors.textInverse },
  celebrate: { marginTop: 12, padding: 10, borderRadius: 10, backgroundColor: colors.primaryLight, borderWidth: 0.5, borderColor: colors.primary, alignItems: 'center' },
  celebrateTxt: { fontSize: 13, fontWeight: '700', color: colors.primary },

  pill: { position: 'absolute', bottom: 80, right: 16, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6, zIndex: 50 },
  pillTxt: { color: colors.textInverse, fontSize: 12, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(10,14,39,0.7)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: colors.surface, borderRadius: 20, width: '100%', maxWidth: 480, maxHeight: '90%', overflow: 'hidden' },
  welcomeIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  welcomeTitle: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
  welcomeSub: { fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
  welcomeStepRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surfaceElevated, borderRadius: 12, padding: 10, marginBottom: 6, borderWidth: 0.5, borderColor: colors.borderStrong },
  welcomeStepNum: { width: 24, height: 24, borderRadius: 8, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  welcomeStepNumTxt: { fontSize: 11, fontWeight: '800', color: colors.primary },
  welcomeStepTxt: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  welcomeCta: { marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14 },
  welcomeCtaTxt: { color: colors.textInverse, fontSize: 16, fontWeight: '700' },
  welcomeDismiss: { fontSize: 12, color: colors.textTertiary, fontWeight: '600', letterSpacing: 0.3 },
})
