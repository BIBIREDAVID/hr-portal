// Public application intake — Section 4/8 require that public inserts into
// `candidates`/`applications` go through a validated server-side path
// rather than a raw client insert. This function is that path: it runs
// with the service role key (bypassing RLS) and is the ONLY way those
// rows get created from the public /apply/:jobId page.
//
// Deploy with: supabase functions deploy apply
// Requires these secrets (see .env.example): SUPABASE_SERVICE_ROLE_KEY,
// RESEND_API_KEY, EMAIL_FROM_ADDRESS. SUPABASE_URL/SUPABASE_ANON_KEY are
// provided automatically by the Supabase Edge Functions runtime.

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RATE_LIMIT_WINDOW_HOURS = 1
const RATE_LIMIT_MAX_SUBMISSIONS = 5

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

  const jobId = String(body.job_id ?? '')
  const name = String(body.name ?? '').trim()
  const email = String(body.email ?? '').trim().toLowerCase()
  const phone = body.phone ? String(body.phone).trim() : null
  const portfolioUrl = body.portfolio_url ? String(body.portfolio_url).trim() : null
  const resumePath = String(body.resume_path ?? '').trim()
  const resumeParsed = body.resume_parsed ?? null
  const customFieldResponses =
    body.custom_field_responses && typeof body.custom_field_responses === 'object'
      ? body.custom_field_responses
      : {}

  if (!jobId || !name || !email || !resumePath) {
    return json({ error: 'job_id, name, email, and resume_path are required' }, 400)
  }
  if (!EMAIL_RE.test(email)) {
    return json({ error: 'That email address doesn\'t look valid' }, 400)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // Job must exist, be open, and not past its expiry.
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, title, status, expires_at')
    .eq('id', jobId)
    .maybeSingle()

  if (jobError) return json({ error: jobError.message }, 500)
  if (!job || job.status !== 'open' || (job.expires_at && new Date(job.expires_at) < new Date())) {
    return json({ error: 'This job is no longer accepting applications' }, 400)
  }

  // Minimal abuse guard: cap submissions per email per rolling window.
  // A real deployment should also rate-limit by IP/fingerprint at the
  // edge (e.g. Cloudflare Turnstile or a WAF rule) — this is a
  // best-effort backstop, not a substitute for that.
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000).toISOString()
  const { count: recentCount, error: rateError } = await supabase
    .from('candidates')
    .select('id', { count: 'exact', head: true })
    .eq('email', email)
    .gte('created_at', since)

  if (rateError) return json({ error: rateError.message }, 500)
  if ((recentCount ?? 0) >= RATE_LIMIT_MAX_SUBMISSIONS) {
    return json({ error: 'Too many submissions from this email address. Please try again later.' }, 429)
  }

  // Duplicate detection by email or phone (Section 6). Reuse the
  // existing candidate row and refresh it with the latest submitted
  // data — candidate/HR-entered data always wins over what was parsed
  // or stored previously (Section 9).
  const duplicateFilter = phone ? `email.ilike.${email},phone.eq.${phone}` : `email.ilike.${email}`
  const { data: existingCandidate, error: findError } = await supabase
    .from('candidates')
    .select('id')
    .or(duplicateFilter)
    .limit(1)
    .maybeSingle()
  if (findError) return json({ error: findError.message }, 500)

  let candidateId: string
  let statusToken: string

  if (existingCandidate) {
    candidateId = existingCandidate.id
    const { data: updated, error: updateError } = await supabase
      .from('candidates')
      .update({
        name,
        phone,
        resume_url: resumePath,
        resume_parsed: resumeParsed,
        portfolio_url: portfolioUrl,
      })
      .eq('id', candidateId)
      .select('status_token')
      .single()
    if (updateError) return json({ error: updateError.message }, 500)
    statusToken = updated.status_token
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from('candidates')
      .insert({
        name,
        email,
        phone,
        resume_url: resumePath,
        resume_parsed: resumeParsed,
        source: 'public_application',
        portfolio_url: portfolioUrl,
      })
      .select('id, status_token')
      .single()
    if (insertError) return json({ error: insertError.message }, 500)
    candidateId = inserted.id
    statusToken = inserted.status_token
  }

  const { data: application, error: applicationError } = await supabase
    .from('applications')
    .insert({
      candidate_id: candidateId,
      job_id: jobId,
      custom_field_responses: customFieldResponses,
    })
    .select('id')
    .single()

  if (applicationError) {
    if (applicationError.code === '23505') {
      return json({ error: 'You\'ve already applied to this job' }, 409)
    }
    return json({ error: applicationError.message }, 500)
  }

  // actor_id is null — this action was taken by the candidate, not a
  // staff member.
  await supabase.from('activity_log').insert({
    application_id: application.id,
    actor_id: null,
    action: existingCandidate ? 'submitted a new application (existing candidate)' : 'submitted this application',
  })

  // Best-effort acknowledgment email — a failure here shouldn't fail the
  // whole application submission.
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const fromAddress = Deno.env.get('EMAIL_FROM_ADDRESS')
  if (resendKey && fromAddress) {
    try {
      const statusUrl = `${Deno.env.get('PUBLIC_SITE_URL') ?? ''}/status/${statusToken}`
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: email,
          subject: `We received your application for ${job.title}`,
          html: `<p>Hi ${name},</p><p>Thanks for applying to <strong>${job.title}</strong>. We'll be in touch as your application moves through our process.</p><p>You can check your status any time: <a href="${statusUrl}">${statusUrl}</a></p>`,
        }),
      })
      await supabase.from('email_log').insert({
        candidate_id: candidateId,
        application_id: application.id,
        type: 'acknowledgment',
      })
    } catch (err) {
      console.error('acknowledgment email failed', err)
    }
  }

  return json({ status_token: statusToken, application_id: application.id }, 201)
})
