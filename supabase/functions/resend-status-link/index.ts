// Public, unauthenticated endpoint backing the "Find my application"
// form on /status: a candidate who lost or never saved their emailed
// status link can ask for it again by email address, instead of the
// portal only working if they still have that original link.
//
// Deliberately returns the SAME generic response whether or not the
// email matches a candidate, and never reveals candidate/application
// data itself — it only re-sends the link to the email address that was
// on file, exactly like a "forgot password" flow. This prevents the
// endpoint from being used to check whether a given email address has
// ever applied (email enumeration).
//
// Deploy with: supabase functions deploy resend-status-link
// Requires: RESEND_API_KEY, EMAIL_FROM_ADDRESS, PUBLIC_SITE_URL,
// SUPABASE_SERVICE_ROLE_KEY secrets (same as the `apply` function).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { withBanner } from '../_shared/emailBanner.ts'

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
const RATE_LIMIT_MAX_REQUESTS = 5

const GENERIC_RESPONSE = {
  message: "If that email has an application with us, we've sent a link to check its status.",
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

  const email = String(body.email ?? '').trim().toLowerCase()
  if (!email || !EMAIL_RE.test(email)) {
    return json({ error: "That email address doesn't look valid" }, 400)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const { data: candidate, error: findError } = await supabase
    .from('candidates')
    .select('id, name, email, status_token')
    .ilike('email', email)
    .maybeSingle()

  if (findError) return json({ error: findError.message }, 500)

  // No match — still return the generic response, just skip sending.
  if (!candidate) return json(GENERIC_RESPONSE, 200)

  // Best-effort abuse guard: cap resend requests per candidate per
  // rolling window, mirroring the `apply` function's rate limit.
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000).toISOString()
  const { count: recentCount, error: rateError } = await supabase
    .from('email_log')
    .select('id', { count: 'exact', head: true })
    .eq('candidate_id', candidate.id)
    .eq('type', 'status_resend')
    .gte('sent_at', since)

  if (rateError) return json({ error: rateError.message }, 500)
  if ((recentCount ?? 0) >= RATE_LIMIT_MAX_REQUESTS) {
    // Still generic to the candidate; they just won't get another email
    // this window.
    return json(GENERIC_RESPONSE, 200)
  }

  const resendKey = Deno.env.get('RESEND_API_KEY')
  const fromAddress = Deno.env.get('EMAIL_FROM_ADDRESS')
  if (resendKey && fromAddress) {
    try {
      const statusUrl = `${Deno.env.get('PUBLIC_SITE_URL') ?? ''}/status/${candidate.status_token}`
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromAddress,
          to: candidate.email,
          subject: 'Your application status link',
          html: withBanner(
            `<p>Hi ${candidate.name},</p><p>Here's your link to check the status of your application(s) any time:</p><p><a href="${statusUrl}">${statusUrl}</a></p><p>If you didn't request this, you can safely ignore this email.</p>`,
            null
          ),
        }),
      })
      if (!emailRes.ok) {
        console.error('status-resend email rejected', emailRes.status, await emailRes.text())
      } else {
        await supabase.from('email_log').insert({ candidate_id: candidate.id, type: 'status_resend' })
      }
    } catch (err) {
      console.error('status-resend email failed', err)
    }
  }

  return json(GENERIC_RESPONSE, 200)
})
