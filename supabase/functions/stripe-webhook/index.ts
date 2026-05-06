import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const body = await req.text()
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  let event
  try {
    event = JSON.parse(body)
  } catch (err) {
    return new Response('Webhook error', { status: 400 })
  }

  const subscription = event.data.object
  const customerId = subscription.customer
  const status = subscription.status

  if (['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) {
    const subStatus = status === 'active' ? 'active' : status === 'trialing' ? 'trial' : 'inactive'
    const endDate = subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null
    await supabase.from('coaches')
      .update({ subscription_status: subStatus, subscription_end: endDate })
      .eq('stripe_customer_id', customerId)
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
