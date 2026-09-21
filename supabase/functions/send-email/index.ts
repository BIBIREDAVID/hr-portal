// Sends a templated email to one or more candidates and logs it to
// `email_log` — backs Phase 7's bulk-reject email and per-stage
// stage-change email triggers. Runs with the service role key (so it
// can read across applications/candidates/jobs regardless of RLS), but
// first verifies the CALLER is an authenticated admin/recruiter — this
// function must never be reachable by an unauthenticated or
// under-privileged request, since it sends real email on someone's
// behalf and writes the audit log.
//
// Deploy with: supabase functions deploy send-email
// Requires: RESEND_API_KEY, EMAIL_FROM_ADDRESS, PUBLIC_SITE_URL secrets
// (same as the `apply` function), plus SUPABASE_SERVICE_ROLE_KEY.

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

const stageLabels: Record<string, string> = {
  new: 'New',
  screening: 'Screening',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Rejected',
}

function renderTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars[key] ?? '')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json({ error: 'Missing Authorization header' }, 401)
  }
  const token = authHeader.replace('Bearer ', '')

  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  )
  const { data: authData, error: authError } = await anonClient.auth.getUser(token)
  if (authError || !authData.user) {
    return json({ error: 'Not authenticated' }, 401)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const { data: staffUser, error: staffError } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', authData.user.id)
    .maybeSingle()

  if (staffError) return json({ error: staffError.message }, 500)
  if (!staffUser || !['admin', 'recruiter'].includes(staffUser.role)) {
    return json({ error: 'Not authorized' }, 403)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const applicationIds = Array.isArray(body.application_ids) ? body.application_ids.map(String) : []
  const type = String(body.type ?? '')
  const subjectTemplate = String(body.subject ?? '')
  const bodyTemplate = String(body.body ?? '')

  if (applicationIds.length === 0 || !['stage_change', 'rejection'].includes(type) || !subjectTemplate || !bodyTemplate) {
    return json({ error: 'application_ids, type (stage_change|rejection), subject, and body are required' }, 400)
  }

  const resendKey = Deno.env.get('RESEND_API_KEY')
  const fromAddress = Deno.env.get('EMAIL_FROM_ADDRESS')
  if (!resendKey || !fromAddress) {
    return json({ error: 'Email sending is not configured (RESEND_API_KEY/EMAIL_FROM_ADDRESS)' }, 500)
  }

  const { data: applications, error: fetchError } = await supabase
    .from('applications')
    .select('id, stage, candidate:candidates(id,name,email,status_token), job:jobs(id,title,hero_image_url)')
    .in('id', applicationIds)

  if (fetchError) return json({ error: fetchError.message }, 500)

  const results = { sent: 0, failed: [] as { application_id: string; error: string }[] }
  const siteUrl = Deno.env.get('PUBLIC_SITE_URL') ?? ''

  for (const app of applications ?? []) {
    try {
      const vars = {
        candidate_name: app.candidate.name,
        job_title: app.job.title,
        stage: stageLabels[app.stage] ?? app.stage,
        status_url: `${siteUrl}/status/${app.candidate.status_token}`,
      }
      const subject = renderTemplate(subjectTemplate, vars)
      const html = withBanner(renderTemplate(bodyTemplate, vars).replace(/\n/g, '<br>'), app.job.hero_image_url)

      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: fromAddress, to: app.candidate.email, subject, html }),
      })

      if (!resendResponse.ok) {
        const errText = await resendResponse.text()
        throw new Error(`Resend error: ${errText}`)
      }

      await supabase.from('email_log').insert({
        candidate_id: app.candidate.id,
        application_id: app.id,
        type,
      })

      results.sent += 1
    } catch (err) {
      results.failed.push({ application_id: app.id, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return json(results, 200)
})
