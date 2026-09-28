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
import { withBanner } from '../_shared/emailBanner.ts'
import { escapeHtml, escapeLike } from '../_shared/format.ts'

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

type Submission = {
  name: string
  phone: string | null
  portfolioUrl: string | null
  resumePath: string
  resumeParsed: unknown
  customFieldResponses: unknown
  sourceDetail: string | null
}

// A submission whose email matches an existing candidate. Knowing an
// email address doesn't prove you own it, so nothing is created or
// changed yet and no status link is returned: the submission is parked
// in pending_applications and a confirmation link goes to the address
// ON FILE. The confirm-application function finishes the job once that
// link is clicked (see migration 0013).
async function holdForEmailConfirmation(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  { candidate, job, submission }: { candidate: { id: string; name: string; email: string }; job: { id: string; title: string; hero_image_url: string | null }; submission: Submission }
) {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const fromAddress = Deno.env.get('EMAIL_FROM_ADDRESS')
  if (!resendKey || !fromAddress) {
    // Without email there's no way to verify the submitter — refuse
    // rather than fall back to trusting the address.
    return json({ error: "We couldn't verify your email right now. Please try again later." }, 503)
  }

  const { data: pending, error: pendingError } = await supabase
    .from('pending_applications')
    .insert({
      candidate_id: candidate.id,
      job_id: job.id,
      name: submission.name,
      phone: submission.phone,
      portfolio_url: submission.portfolioUrl,
      resume_url: submission.resumePath,
      resume_parsed: submission.resumeParsed,
      custom_field_responses: submission.customFieldResponses,
      source_detail: submission.sourceDetail,
    })
    .select('id, token')
    .single()
  if (pendingError) return json({ error: pendingError.message }, 500)

  const confirmUrl = `${Deno.env.get('PUBLIC_SITE_URL') ?? ''}/confirm/${pending.token}`
  try {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromAddress,
        to: candidate.email,
        subject: `Confirm your application for ${job.title}`,
        html: withBanner(
          `<p>Hi ${escapeHtml(candidate.name)},</p><p>We received an application for <strong>${escapeHtml(job.title)}</strong> using this email address. Because you've applied with us before, please confirm it was you:</p><p><a href="${escapeHtml(confirmUrl)}">Confirm my application</a></p><p>The link expires in 7 days. If you didn't apply, ignore this email — nothing will be submitted and your details won't change.</p>`,
          job.hero_image_url
        ),
      }),
    })
    if (!emailRes.ok) {
      console.error('confirmation email rejected', emailRes.status, await emailRes.text())
      await supabase.from('pending_applications').delete().eq('id', pending.id)
      return json({ error: "We couldn't send your confirmation email. Please try again later." }, 502)
    }
  } catch (err) {
    console.error('confirmation email failed', err)
    await supabase.from('pending_applications').delete().eq('id', pending.id)
    return json({ error: "We couldn't send your confirmation email. Please try again later." }, 502)
  }

  await supabase.from('email_log').insert({ candidate_id: candidate.id, type: 'application_confirmation' })

  // Never includes the existing candidate's status token.
  return json({ pending_confirmation: true }, 202)
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
  const sourceDetail = body.source_detail ? String(body.source_detail).slice(0, 500) : null

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
    .select('id, title, status, expires_at, hero_image_url')
    .eq('id', jobId)
    .maybeSingle()

  if (jobError) return json({ error: jobError.message }, 500)
  if (!job || job.status !== 'open' || (job.expires_at && new Date(job.expires_at) < new Date())) {
    return json({ error: 'This job is no longer accepting applications' }, 400)
  }

  // Duplicate detection (Section 6). Public submissions match on EMAIL
  // ONLY, exactly (wildcards escaped): matching on phone would link a
  // stranger's submission to an existing candidate and then email that
  // candidate's status link to the stranger's address. Phone-based
  // duplicates are still surfaced to HR in the manual-upload flow.
  const { data: existingCandidate, error: findError } = await supabase
    .from('candidates')
    .select('id, name, email')
    .ilike('email', escapeLike(email))
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (findError) return json({ error: findError.message }, 500)

  if (existingCandidate) {
    // Everything below is checked BEFORE any write, so a rejected
    // submission never modifies the existing candidate.
    const { data: priorApplication, error: priorError } = await supabase
      .from('applications')
      .select('id')
      .eq('candidate_id', existingCandidate.id)
      .eq('job_id', jobId)
      .maybeSingle()
    if (priorError) return json({ error: priorError.message }, 500)
    if (priorApplication) {
      return json({ error: 'You\'ve already applied to this job' }, 409)
    }

    // Minimal abuse guard: cap submissions per email per rolling window
    // (each one sends a confirmation email to the address on file). A
    // real deployment should also rate-limit by IP at the edge (e.g.
    // Cloudflare Turnstile or a WAF rule) — this is a best-effort
    // backstop, not a substitute for that.
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000).toISOString()
    const { count: recentCount, error: rateError } = await supabase
      .from('pending_applications')
      .select('id', { count: 'exact', head: true })
      .eq('candidate_id', existingCandidate.id)
      .gte('created_at', since)
    if (rateError) return json({ error: rateError.message }, 500)
    if ((recentCount ?? 0) >= RATE_LIMIT_MAX_SUBMISSIONS) {
      return json({ error: 'Too many submissions from this email address. Please try again later.' }, 429)
    }

    return await holdForEmailConfirmation(supabase, {
      candidate: existingCandidate,
      job,
      submission: { name, phone, portfolioUrl, resumePath, resumeParsed, customFieldResponses, sourceDetail },
    })
  }

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
  const candidateId: string = inserted.id
  const statusToken: string = inserted.status_token

  const { data: application, error: applicationError } = await supabase
    .from('applications')
    .insert({
      candidate_id: candidateId,
      job_id: jobId,
      custom_field_responses: customFieldResponses,
      source_detail: sourceDetail,
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
    action: 'submitted this application',
  })

  // Best-effort acknowledgment email — a failure here shouldn't fail the
  // whole application submission.
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const fromAddress = Deno.env.get('EMAIL_FROM_ADDRESS')
  if (resendKey && fromAddress) {
    try {
      const statusUrl = `${Deno.env.get('PUBLIC_SITE_URL') ?? ''}/status/${statusToken}`
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: email,
          subject: `We received your application for ${job.title}`,
          html: withBanner(
            `<p>Hi ${escapeHtml(name)},</p><p>Thanks for applying to <strong>${escapeHtml(job.title)}</strong>. We'll be in touch as your application moves through our process.</p><p>You can check your status any time: <a href="${escapeHtml(statusUrl)}">${escapeHtml(statusUrl)}</a></p>`,
            job.hero_image_url
          ),
        }),
      })
      if (!emailRes.ok) {
        // Resend returns a JSON error body (e.g. unverified domain) with a
        // non-2xx status rather than a network failure, so this needs its
        // own check — fetch() alone doesn't throw on that.
        console.error('acknowledgment email rejected', emailRes.status, await emailRes.text())
      } else {
        await supabase.from('email_log').insert({
          candidate_id: candidateId,
          application_id: application.id,
          type: 'acknowledgment',
        })
      }
    } catch (err) {
      console.error('acknowledgment email failed', err)
    }
  }

  return json({ status_token: statusToken, application_id: application.id }, 201)
})
