// Candidate-side chat access. Candidates have no account, so per
// Section 4/8 they are never granted a direct RLS path to
// `chat_messages` — this function validates their `status_token`
// server-side (with the service role key) before reading or writing
// anything on their behalf. A leaked/guessed token alone is never
// enough on its own without this validation step succeeding.

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

  if (!statusToken || !applicationId || !['list', 'send'].includes(action)) {
    return json({ error: 'status_token, application_id, and action (list|send) are required' }, 400)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // Validate the token actually owns this application before doing
  // anything else — this is the entire security boundary for the
  // candidate side.
  const { data: application, error: applicationError } = await supabase
    .from('applications')
    .select('id, assigned_to, candidate:candidates!inner(id, status_token)')
    .eq('id', applicationId)
    .eq('candidate.status_token', statusToken)
    .maybeSingle()

  if (applicationError) return json({ error: applicationError.message }, 500)
  if (!application) return json({ error: 'Not found' }, 404)

  if (action === 'list') {
    const { data: messages, error: listError } = await supabase
      .from('chat_messages')
      .select('id, sender_type, body, created_at')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: true })
    if (listError) return json({ error: listError.message }, 500)

    // Best-effort read receipt — never block the read on this.
    await supabase
      .from('chat_messages')
      .update({ read_by_candidate: true })
      .eq('application_id', applicationId)
      .eq('sender_type', 'hr')
      .eq('read_by_candidate', false)

    return json({ messages })
  }

  // action === 'send'
  const messageBody = String(body.body ?? '').trim()
  if (!messageBody) return json({ error: 'body is required' }, 400)

  const { data: inserted, error: insertError } = await supabase
    .from('chat_messages')
    .insert({
      application_id: applicationId,
      sender_type: 'candidate',
      sender_user_id: null,
      body: messageBody,
    })
    .select('id, sender_type, body, created_at')
    .single()

  if (insertError) return json({ error: insertError.message }, 500)

  if (application.assigned_to) {
    await supabase.from('notifications').insert({
      user_id: application.assigned_to,
      type: 'chat_message',
      reference_id: applicationId,
      message: 'New chat message from a candidate',
    })
  }

  return json({ message: inserted }, 201)
})
