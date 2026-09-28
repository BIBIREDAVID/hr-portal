// Completes a returning candidate's application once they click the
// confirmation link emailed by the `apply` function (see migration
// 0013). Possessing the token proves control of the email address on
// file, so only here do we create the application, apply the submitted
// details to the candidate, and hand back their status token.
//
// Deploy with: supabase functions deploy confirm-application
// Requires SUPABASE_SERVICE_ROLE_KEY (same as `apply`).

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

  const token = String(body.token ?? '').trim()
  if (!token) return json({ error: 'token is required' }, 400)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const { data: pending, error: pendingError } = await supabase
    .from('pending_applications')
    .select('*, candidate:candidates(id, status_token), job:jobs(id, title, status, expires_at)')
    .eq('token', token)
    .maybeSingle()

  if (pendingError) return json({ error: pendingError.message }, 500)
  if (!pending) return json({ error: 'This confirmation link is invalid.' }, 404)

  // Clicking the link twice just takes them to their status page again.
  if (pending.confirmed_at) {
    return json({ status_token: pending.candidate.status_token, application_id: pending.application_id }, 200)
  }
  if (new Date(pending.expires_at) < new Date()) {
    return json({ error: 'This confirmation link has expired. Please apply again.' }, 410)
  }

  const job = pending.job
  if (!job || job.status !== 'open' || (job.expires_at && new Date(job.expires_at) < new Date())) {
    return json({ error: 'This job is no longer accepting applications.' }, 400)
  }

  const { data: application, error: applicationError } = await supabase
    .from('applications')
    .insert({
      candidate_id: pending.candidate_id,
      job_id: pending.job_id,
      custom_field_responses: pending.custom_field_responses ?? {},
      source_detail: pending.source_detail,
    })
    .select('id')
    .single()

  let applicationId: string | null = application?.id ?? null
  if (applicationError) {
    // Already applied (e.g. two pending submissions for the same job,
    // both confirmed) — not an error for the candidate; send them to
    // their status page without touching their details again.
    if (applicationError.code !== '23505') return json({ error: applicationError.message }, 500)
    const { data: existing } = await supabase
      .from('applications')
      .select('id')
      .eq('candidate_id', pending.candidate_id)
      .eq('job_id', pending.job_id)
      .maybeSingle()
    applicationId = existing?.id ?? null
  } else {
    // Submitted data wins over what was stored before (Section 9), but
    // optional fields left blank keep their previous values.
    const patch: Record<string, unknown> = {
      name: pending.name,
      resume_url: pending.resume_url,
      resume_parsed: pending.resume_parsed,
    }
    if (pending.phone) patch.phone = pending.phone
    if (pending.portfolio_url) patch.portfolio_url = pending.portfolio_url
    const { error: updateError } = await supabase.from('candidates').update(patch).eq('id', pending.candidate_id)
    if (updateError) console.error('candidate refresh after confirmation failed', updateError.message)

    await supabase.from('activity_log').insert({
      application_id: applicationId,
      actor_id: null,
      action: 'submitted a new application (existing candidate, email confirmed)',
    })
  }

  await supabase
    .from('pending_applications')
    .update({ confirmed_at: new Date().toISOString(), application_id: applicationId })
    .eq('id', pending.id)

  return json({ status_token: pending.candidate.status_token, application_id: applicationId }, 201)
})
