import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const { user_id } = await req.json()
    if (!user_id) throw new Error('Missing user_id')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Verify the request is from the authenticated user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing auth')
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user || user.id !== user_id) throw new Error('Unauthorized')

    // Delete user data from custom tables
    await supabaseAdmin.from('session_records').delete().eq('coach_id', user_id)
    await supabaseAdmin.from('messages').delete().eq('coach_id', user_id)
    await supabaseAdmin.from('sessions').delete().eq('coach_id', user_id)
    await supabaseAdmin.from('lessons').delete().eq('coach_id', user_id)
    await supabaseAdmin.from('exercises').delete().eq('coach_id', user_id)
    await supabaseAdmin.from('daily_briefings').delete().eq('coach_id', user_id)
    await supabaseAdmin.from('players').delete().eq('coach_id', user_id)
    await supabaseAdmin.from('push_tokens').delete().eq('user_id', user_id)

    // Delete the auth user
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id)
    if (deleteError) throw deleteError

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
