import { supabase } from '../supabase'

// Adding a lesson INSERTs into both `lessons` (agenda) and `sessions` (revenue).
// Deleting from only one table leaves an orphan row — a ghost lesson in the agenda
// or ghost revenue in Sessions. This helper deletes the matching pair atomically.
//
// Pass whichever id you have. The matching row in the other table is found by
// (coach_id, player_id, date) and limited to ONE row so multiple sessions on the
// same day for the same player don't all get nuked.
export async function deleteCoachSession({ coachId, playerId, sessionDate, lessonId, sessionId }) {
  if (!coachId) throw new Error('deleteCoachSession: coachId is required')

  // Delete the lesson row (by id if given, otherwise find a matching one).
  if (lessonId) {
    const { error } = await supabase.from('lessons').delete().eq('id', lessonId)
    if (error) throw error
  } else if (playerId && sessionDate) {
    const { data: matches, error: findErr } = await supabase
      .from('lessons')
      .select('id')
      .eq('coach_id', coachId)
      .eq('player_id', playerId)
      .eq('lesson_date', sessionDate)
      .limit(1)
    if (findErr) throw findErr
    if (matches && matches[0]) {
      const { error } = await supabase.from('lessons').delete().eq('id', matches[0].id)
      if (error) throw error
    }
  }

  // Delete the session row (by id if given, otherwise find a matching one).
  // Events (player_id null) never get a session row, so skip when playerId is null.
  if (sessionId) {
    const { error } = await supabase.from('sessions').delete().eq('id', sessionId)
    if (error) throw error
  } else if (playerId && sessionDate) {
    const { data: matches, error: findErr } = await supabase
      .from('sessions')
      .select('id')
      .eq('coach_id', coachId)
      .eq('player_id', playerId)
      .eq('session_date', sessionDate)
      .limit(1)
    if (findErr) throw findErr
    if (matches && matches[0]) {
      const { error } = await supabase.from('sessions').delete().eq('id', matches[0].id)
      if (error) throw error
    }
  }
}
