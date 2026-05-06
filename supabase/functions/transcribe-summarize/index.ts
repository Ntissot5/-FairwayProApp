import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY') || ''
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_KEY') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface SessionEvent {
  type: 'vocal' | 'note' | 'drill'
  timestamp: number
  audio_path?: string
  duration?: number
  text?: string
  name?: string
  description?: string
}

serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  let body: { session_record_id?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 })
  }

  const { session_record_id } = body
  if (!session_record_id) {
    return new Response(JSON.stringify({ error: 'session_record_id required' }), { status: 400 })
  }

  // 1. Fetch session_record
  const { data: record, error: fetchErr } = await supabase
    .from('session_records')
    .select('*')
    .eq('id', session_record_id)
    .single()

  if (fetchErr || !record) {
    return new Response(JSON.stringify({ error: 'Session record not found' }), { status: 404 })
  }

  const events: SessionEvent[] = record.events || []
  const vocalEvents = events.filter(e => e.type === 'vocal' && e.audio_path)
  const noteEvents = events.filter(e => e.type === 'note')
  const drillEvents = events.filter(e => e.type === 'drill')

  // 2. Transcribe vocal events via Whisper
  const transcriptions: { timestamp: number; text: string }[] = []

  for (const vocal of vocalEvents) {
    try {
      // Download audio from Storage
      const { data: audioBlob, error: dlErr } = await supabase.storage
        .from('session-audio')
        .download(vocal.audio_path!)

      if (dlErr || !audioBlob) {
        console.error(`[Whisper] Download failed for ${vocal.audio_path}:`, dlErr)
        continue
      }

      // Call Whisper API
      const formData = new FormData()
      formData.append('file', audioBlob, 'audio.m4a')
      formData.append('model', 'whisper-1')
      formData.append('language', 'fr')

      const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_KEY}` },
        body: formData,
      })

      if (!whisperRes.ok) {
        console.error(`[Whisper] API error ${whisperRes.status} for ${vocal.audio_path}`)
        continue
      }

      const whisperData = await whisperRes.json()
      if (whisperData.text) {
        transcriptions.push({ timestamp: vocal.timestamp, text: whisperData.text })
      }
    } catch (e) {
      console.error(`[Whisper] Exception for ${vocal.audio_path}:`, e)
    }
  }

  // 3. Build full transcription text
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  let fullTranscription = ''
  if (transcriptions.length > 0) {
    fullTranscription += 'VOCAUX COACH:\n'
    for (const t of transcriptions) {
      fullTranscription += `[${formatTime(t.timestamp)}] ${t.text}\n`
    }
  }
  if (noteEvents.length > 0) {
    fullTranscription += '\nNOTES COACH:\n'
    for (const n of noteEvents) {
      fullTranscription += `[${formatTime(n.timestamp)}] ${n.text}\n`
    }
  }
  if (drillEvents.length > 0) {
    fullTranscription += '\nDRILLS:\n'
    for (const d of drillEvents) {
      fullTranscription += `[${formatTime(d.timestamp)}] ${d.name}${d.description ? ' — ' + d.description : ''}\n`
    }
  }

  // 4. Fetch player info
  const { data: player } = await supabase
    .from('players')
    .select('full_name, current_handicap, current_level, bio')
    .eq('id', record.player_id)
    .single()

  const playerName = player?.full_name || 'Joueur'
  const durationMin = record.duration_seconds ? Math.round(record.duration_seconds / 60) : 0

  // 5. Build Claude prompt
  const prompt = `Tu es l'assistant IA de FairwayPro, outil pour coachs de golf. Tu generes un resume structure d'une session de coaching.

CONTEXTE SESSION :
- Eleve : ${playerName}
- Handicap : ${player?.current_handicap ?? 'Non renseigne'}
- Niveau : ${player?.current_level || 'Non renseigne'}
- Duree session : ${durationMin} minutes
- Nombre de vocaux coach : ${vocalEvents.length}
- Nombre de notes : ${noteEvents.length}
- Nombre de drills : ${drillEvents.length}

CONTENU CAPTURE PENDANT LA SESSION :
${fullTranscription || '(Aucun contenu capture)'}

GENERE un resume structure au format JSON STRICT suivant :
{
  "worked_on": "resume en 2-3 phrases de ce qui a ete travaille",
  "strengths": ["point fort 1", "point fort 2"],
  "improvements": ["axe d'amelioration 1", "axe d'amelioration 2"],
  "drills": ["drill recommande 1", "drill recommande 2"],
  "coach_message": "message personnalise du coach pour l'eleve (2-3 phrases encourageantes)"
}

REGLES :
- Reponds UNIQUEMENT avec le JSON, rien d'autre
- 2-3 items max par array
- Ton professionnel mais chaleureux
- Si pas assez de contenu, base-toi sur les drills et notes pour deduire le travail
- Le coach_message doit etre personnel et encourageant, adresse a l'eleve par son prenom (${playerName.split(' ')[0]})`

  // 6. Call Claude API
  let aiSummary: Record<string, unknown>

  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const claudeData = await claudeRes.json()
    const text = claudeData.content?.[0]?.text || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)

    if (!jsonMatch) throw new Error('No JSON in Claude response')
    aiSummary = JSON.parse(jsonMatch[0].replace(/```json|```/g, '').trim())
  } catch (e) {
    console.error('[Claude] Error:', e)
    // Fallback static summary
    aiSummary = {
      worked_on: `Session de ${durationMin} minutes avec ${playerName}. ${noteEvents.length} notes et ${drillEvents.length} drills enregistres.`,
      strengths: ['Engagement pendant la session'],
      improvements: ['A analyser lors de la prochaine session'],
      drills: drillEvents.length > 0
        ? drillEvents.slice(0, 3).map(d => d.name)
        : ['Continuer le travail engage'],
      coach_message: `Bravo ${playerName.split(' ')[0]} pour cette session ! Continue comme ca.`,
    }
  }

  // 7. Update session_record
  const { error: updateErr } = await supabase
    .from('session_records')
    .update({
      transcription: fullTranscription || null,
      ai_summary: aiSummary,
      status: 'ready',
    })
    .eq('id', session_record_id)

  if (updateErr) {
    return new Response(JSON.stringify({ error: 'Failed to update session record', details: updateErr.message }), { status: 500 })
  }

  return new Response(JSON.stringify({ success: true, summary: aiSummary }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
