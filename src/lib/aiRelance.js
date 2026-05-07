import { supabase } from '../supabase'

const CLAUDE_PROXY = 'https://aqdifzgqfemfdcigxsgw.supabase.co/functions/v1/claude-proxy'
const DAYS_FR = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

export async function generateRelanceMessage(player, sessions) {
  const ps = (sessions || []).filter(s => s.player_id === player.id).sort((a, b) => new Date(b.session_date) - new Date(a.session_date))
  const last = ps[0]
  const days = last ? Math.floor((Date.now() - new Date(last.session_date)) / (1000 * 60 * 60 * 24)) : 99

  const { data: slots } = await supabase.from('availabilities').select('*').order('day_of_week')
  const slotText = slots && slots.length > 0
    ? 'Créneaux disponibles: ' + slots.map(s => DAYS_FR[s.day_of_week] + ' ' + s.start_time?.slice(0, 5)).join(', ')
    : ''

  const response = await fetch(CLAUDE_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Tu es un coach de golf professionnel. Écris un message court et chaleureux pour relancer un élève inactif sur le practice. Élève: ${player.full_name}, HCP: ${player.current_handicap}, inactif depuis ${days} jours. ${slotText ? slotText + '. Propose un créneau précis.' : ''} 2-3 phrases max, pas de signature.`
      }]
    })
  })

  const data = await response.json()
  return data.content?.[0]?.text?.trim() || ''
}

export async function sendRelanceMessage(coachId, player, message) {
  // Get fresh auth user to avoid stale coachId
  const { data: { user: authUser } } = await supabase.auth.getUser()
  const safeCoachId = authUser?.id || coachId

  // Insert message in DB
  const { error: insertErr } = await supabase.from('messages').insert({
    coach_id: safeCoachId,
    player_id: player.id,
    sender: 'coach',
    content: message,
  })
  if (insertErr) throw new Error('Message non envoyé: ' + insertErr.message)

  // Send push notification to player
  if (player.player_user_id) {
    const { data: tokenRow } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', player.player_user_id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (tokenRow?.token) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: tokenRow.token,
          title: 'Message de ton coach',
          body: message.slice(0, 60),
          data: { type: 'message' },
          sound: 'default',
        }),
      })
    }
  }
}
