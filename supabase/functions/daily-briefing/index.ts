// FairwayPro: Daily Briefing Edge Function
// Triggered by pg_cron at 6:30 AM or manually via HTTP POST
// Generates personalized morning briefing for each coach using Claude API
// Sends push notification via Expo Push

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_KEY') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface Lesson {
  id: string
  lesson_date: string
  start_time: string
  player_id: string | null
  is_private_event: boolean
  title: string | null
  players: { full_name: string; current_handicap: number } | null
}

interface Session {
  id: string
  player_id: string
  session_date: string
  price: number
  paid: boolean
  notes: string | null
}

serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  const today = new Date().toISOString().split('T')[0]

  // Option: target a single coach (manual trigger) or all coaches (cron)
  const body = await req.json().catch(() => ({}))
  const targetCoachId = body.coach_id || null

  // Get all coaches with push tokens (or just one if targeted)
  let query = supabase.from('push_tokens').select('user_id, token')
  if (targetCoachId) query = query.eq('user_id', targetCoachId)
  const { data: coaches } = await query

  if (!coaches || coaches.length === 0) {
    return new Response(JSON.stringify({ message: 'No coaches with push tokens' }), { status: 200 })
  }

  const results = []

  for (const coach of coaches) {
    try {
      const briefing = await generateBriefing(supabase, coach.user_id, today)
      if (!briefing) continue

      // Send push notification
      await sendExpoPush(coach.token, briefing.pushTitle, briefing.pushBody, {
        type: 'daily_briefing',
        briefing: JSON.stringify(briefing.cards),
      })

      // Store briefing in DB for the mobile UI
      await supabase.from('daily_briefings').upsert({
        coach_id: coach.user_id,
        briefing_date: today,
        cards: briefing.cards,
        created_at: new Date().toISOString(),
      }, { onConflict: 'coach_id,briefing_date' })

      results.push({ coach_id: coach.user_id, status: 'sent' })
    } catch (e) {
      results.push({ coach_id: coach.user_id, status: 'error', error: (e as Error).message })
    }
  }

  return new Response(JSON.stringify({ results }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})

async function generateBriefing(supabase: any, coachId: string, today: string) {
  // 1. Today's lessons
  const { data: todayLessons } = await supabase
    .from('lessons')
    .select('*, players(full_name, current_handicap)')
    .eq('coach_id', coachId)
    .eq('lesson_date', today)
    .eq('is_private_event', false)
    .order('start_time', { ascending: true }) as { data: Lesson[] }

  // 2. All sessions (for revenue + inactive detection)
  const { data: allSessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('coach_id', coachId)
    .order('session_date', { ascending: false }) as { data: Session[] }

  // 3. All players
  const { data: players } = await supabase
    .from('players')
    .select('id, full_name, current_handicap')
    .eq('coach_id', coachId)

  // 4. Unpaid sessions (overdue > 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const overduePayments = (allSessions || []).filter(
    (s: Session) => !s.paid && s.session_date < sevenDaysAgo
  )

  // 5. Inactive players (14+ days without session)
  const now = new Date()
  const inactivePlayers = (players || []).filter((p: any) => {
    const playerSessions = (allSessions || []).filter((s: Session) => s.player_id === p.id)
    if (playerSessions.length === 0) return true
    const lastSession = playerSessions[0] // already sorted desc
    const daysSince = Math.floor((now.getTime() - new Date(lastSession.session_date).getTime()) / (1000 * 60 * 60 * 24))
    return daysSince > 14
  })

  // 6. Coach name
  const { data: authUser } = await supabase.auth.admin.getUserById(coachId)
  const coachName = authUser?.user?.user_metadata?.full_name || authUser?.user?.email?.split('@')[0] || 'Coach'

  // 7. This month revenue
  const thisMonthSessions = (allSessions || []).filter((s: Session) => {
    const d = new Date(s.session_date)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const monthRevenue = thisMonthSessions.reduce((sum: number, s: Session) => sum + (s.price || 0), 0)

  // Build context for Claude
  const lessonsList = (todayLessons || [])
    .map((l: Lesson) => `${(l.start_time || '').slice(0, 5)} — ${l.players?.full_name || 'Cours prive'}${l.players?.current_handicap != null ? ' (HCP ' + l.players.current_handicap + ')' : ''}`)
    .join('\n')

  const inactiveList = inactivePlayers.slice(0, 3).map((p: any) => p.full_name).join(', ')
  const overdueTotal = overduePayments.reduce((sum: number, s: Session) => sum + (s.price || 0), 0)

  // Generate briefing via Claude API
  const prompt = `Tu es l'assistant IA de ${coachName}, coach de golf professionnel. Genere un briefing matinal personnalise en francais.

DONNEES DU JOUR (${today}):
- Cours aujourd'hui: ${(todayLessons || []).length}
${lessonsList || '(aucun cours)'}
- Revenus ce mois: ${monthRevenue}€ (${thisMonthSessions.length} sessions)
- Paiements en retard: ${overduePayments.length} (${overdueTotal}€)
- Joueurs inactifs (+14j): ${inactivePlayers.length}${inactiveList ? ' (' + inactiveList + ')' : ''}
- Total joueurs: ${(players || []).length}

GENERE exactement 3 cartes au format JSON:
{
  "greeting": "Bonjour ${coachName}",
  "card1_title": "Aujourd'hui",
  "card1_items": ["item1", "item2", "item3"],
  "card2_title": "A noter",
  "card2_items": ["item1", "item2"],
  "card3_title": "Suggestion",
  "card3_text": "une suggestion actionable"
}

REGLES:
- Card1 = resume de la journee (cours, premier eleve, heure)
- Card2 = alertes (paiements, inactifs, tendances). Si rien a noter, ecris "Tout roule !"
- Card3 = une suggestion concrete (relancer un eleve, preparer un drill, feliciter un progres)
- Ton chaleureux et professionnel, pas robotique
- 1-2 lignes max par item
- Reponds UNIQUEMENT avec le JSON, rien d'autre`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()
    const text = data.content?.[0]?.text || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')

    const cards = JSON.parse(jsonMatch[0])

    // Build push notification text
    const lessonCount = (todayLessons || []).length
    const pushTitle = cards.greeting || `Bonjour ${coachName}`
    const pushBody = lessonCount > 0
      ? `${lessonCount} cours aujourd'hui · Premier a ${(todayLessons[0]?.start_time || '').slice(0, 5)}`
      : 'Aucun cours aujourd\'hui · Bonne journee !'

    return { pushTitle, pushBody, cards }
  } catch (e) {
    // Fallback: static briefing if Claude API fails
    const lessonCount = (todayLessons || []).length
    return {
      pushTitle: `Bonjour ${coachName}`,
      pushBody: lessonCount > 0
        ? `${lessonCount} cours aujourd'hui`
        : 'Bonne journee !',
      cards: {
        greeting: `Bonjour ${coachName}`,
        card1_title: 'Aujourd\'hui',
        card1_items: lessonCount > 0
          ? (todayLessons || []).slice(0, 3).map((l: Lesson) => `${(l.start_time || '').slice(0, 5)} — ${l.players?.full_name || 'Cours'}`)
          : ['Aucun cours programme'],
        card2_title: 'A noter',
        card2_items: inactivePlayers.length > 0
          ? [`${inactivePlayers.length} joueur(s) inactif(s)`]
          : ['Tout roule !'],
        card3_title: 'Suggestion',
        card3_text: 'Profitez de cette journee pour preparer vos prochaines sessions.',
      },
    }
  }
}

async function sendExpoPush(token: string, title: string, body: string, data: Record<string, string> = {}) {
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: token, title, body, data, sound: 'default' }),
  })
}
