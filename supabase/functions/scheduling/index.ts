// Candidate-side interview self-scheduling. Candidates have no
// account, so — same pattern as the `chat` function — this validates
// their status_token server-side before listing or booking any slot
// on their behalf. A leaked/guessed slot id alone is never enough.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const statusToken = String(body.status_token ?? '')
  const applicationId = String(body.application_id ?? '')
  const action = String(body.action ?? '')

  if (!statusToken || !applicationId || !['list', 'book'].includes(action)) {
    return json({ error: 'status_token, application_id, and action (list|book) are required' }, 400)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const { data: application, error: applicationError } = await supabase
    .from('applications')
    .select('id, assigned_to, candidate:candidates!inner(id, name, status_token)')
    .eq('id', applicationId)
    .eq('candidate.status_token', statusToken)
    .maybeSingle()

  if (applicationError) return json({ error: applicationError.message }, 500)
  if (!application) return json({ error: 'Not found' }, 404)

  if (action === 'list') {
    const { data: slots, error: listError } = await supabase
      .from('interview_slots')
      .select('id, starts_at, duration_minutes, interviewer:users!interview_slots_interviewer_id_fkey(name)')
      .eq('application_id', applicationId)
      .eq('status', 'open')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
    if (listError) return json({ error: listError.message }, 500)
    return json({ slots })
  }

  // action === 'book'
  const slotId = String(body.slot_id ?? '')
  if (!slotId) return json({ error: 'slot_id is required' }, 400)

  const { data: slot, error: slotError } = await supabase
    .from('interview_slots')
    .select('id, application_id, interviewer_id, starts_at, status')
    .eq('id', slotId)
    .maybeSingle()

  if (slotError) return json({ error: slotError.message }, 500)
  if (!slot || slot.application_id !== applicationId) return json({ error: 'Slot not found' }, 404)
  if (slot.status !== 'open') return json({ error: 'That time is no longer available' }, 409)

  const { error: bookError } = await supabase
    .from('interview_slots')
    .update({ status: 'booked' })
    .eq('id', slotId)
    .eq('status', 'open')
  if (bookError) return json({ error: bookError.message }, 500)

  // Free up the other proposed times for this application now that one
  // is taken.
  await supabase
    .from('interview_slots')
    .update({ status: 'cancelled' })
    .eq('application_id', applicationId)
    .eq('status', 'open')
    .neq('id', slotId)

  const { data: interview, error: interviewError } = await supabase
    .from('interviews')
    .insert({
      application_id: applicationId,
      scheduled_at: slot.starts_at,
      mode: 'external',
      interviewer_id: slot.interviewer_id,
      status: 'scheduled',
    })
    .select('id, scheduled_at')
    .single()
  if (interviewError) return json({ error: interviewError.message }, 500)

  await supabase.from('activity_log').insert({
    application_id: applicationId,
    actor_id: null,
    action: 'candidate booked an interview time',
  })

  if (application.assigned_to) {
    await supabase.from('notifications').insert({
      user_id: application.assigned_to,
      type: 'interview_booked',
      reference_id: applicationId,
      message: `${application.candidate.name} booked an interview time`,
    })
  }

  return json({ interview }, 201)
})
