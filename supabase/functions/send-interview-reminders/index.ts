// Automated interview reminders. Scans for interviews that are still
// `scheduled`, start within the next 24 hours, and haven't been reminded
// about yet (`reminder_sent_at is null`), then for each one:
//   - emails the candidate (best-effort, if Resend is configured) with
//     the time and their status-page link;
//   - emails + creates an in-app notification for every panelist, same
//     shape as notify-interview-assignment's reminder-ish messaging;
//   - stamps `reminder_sent_at` so it's never sent twice.
//
// Two ways to call it, both allowed:
//   1. An authenticated admin/recruiter, via the dashboard's "Send
//      reminders now" button (same auth pattern as send-email).
//   2. pg_cron, on a schedule (see migration 0011), which can't hold a
//      user JWT — it instead sends a shared `x-cron-secret` header that
//      must match the CRON_SECRET function secret.
//
// Deploy with: supabase functions deploy send-interview-reminders
// Requires: RESEND_API_KEY, EMAIL_FROM_ADDRESS, PUBLIC_SITE_URL,
// SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET secrets.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const REMINDER_WINDOW_HOURS = 24

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // Auth: either the shared cron secret, or a signed-in admin/recruiter.
  const cronSecret = req.headers.get('x-cron-secret')
  const isCron = !!cronSecret && cronSecret === Deno.env.get('CRON_SECRET')

  if (!isCron) {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)
    const token = authHeader.replace('Bearer ', '')

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )
    const { data: authData, error: authError } = await anonClient.auth.getUser(token)
    if (authError || !authData.user) return json({ error: 'Not authenticated' }, 401)

    const { data: staffUser, error: staffError } = await supabase
      .from('users')
      .select('id, role')
      .eq('auth_id', authData.user.id)
      .maybeSingle()
    if (staffError) return json({ error: staffError.message }, 500)
    if (!staffUser || !['admin', 'recruiter'].includes(staffUser.role)) {
      return json({ error: 'Not authorized' }, 403)
    }
  }

  const windowEnd = new Date(Date.now() + REMINDER_WINDOW_HOURS * 60 * 60 * 1000).toISOString()
  const now = new Date().toISOString()

  const { data: dueInterviews, error: dueError } = await supabase
    .from('interviews')
    .select(
      `id, scheduled_at, external_link, stage:job_interview_stages(name),
       application:applications(id, candidate:candidates(id,name,email,status_token), job:jobs(id,title,hero_image_url)),
       panel:interview_panel(user:users(id,name,email))`
    )
    .eq('status', 'scheduled')
    .is('reminder_sent_at', null)
    .gte('scheduled_at', now)
    .lte('scheduled_at', windowEnd)

  if (dueError) return json({ error: dueError.message }, 500)

  const resendKey = Deno.env.get('RESEND_API_KEY')
  const fromAddress = Deno.env.get('EMAIL_FROM_ADDRESS')
  const siteUrl = Deno.env.get('PUBLIC_SITE_URL') ?? ''

  const results = { interviews_processed: 0, candidate_emails_sent: 0, panelist_emails_sent: 0, panelist_notifications: 0, failed: [] as { interview_id: string; error: string }[] }

  async function sendEmail(to: string, subject: string, html: string) {
    if (!resendKey || !fromAddress) return false
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromAddress, to, subject, html }),
    })
    if (!res.ok) {
      console.error('reminder email rejected', res.status, await res.text())
      return false
    }
    return true
  }

  for (const interview of dueInterviews ?? []) {
    try {
      const candidate = interview.application?.candidate
      const job = interview.application?.job
      const stageName = interview.stage?.name
      const when = interview.scheduled_at
        ? new Date(interview.scheduled_at as string).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
        : 'soon'

      if (candidate?.email && job) {
        const statusUrl = `${siteUrl}/status/${candidate.status_token}`
        const html = `<p>Hi ${candidate.name},</p><p>This is a reminder that your interview for <strong>${job.title}</strong> is coming up on <strong>${when}</strong>${
          interview.external_link ? ` at <a href="${interview.external_link}">${interview.external_link}</a>` : ''
        }.</p><p>You can review your application any time: <a href="${statusUrl}">${statusUrl}</a></p>`
        const sent = await sendEmail(candidate.email, `Reminder: your interview for ${job.title} is coming up`, html)
        if (sent) {
          results.candidate_emails_sent += 1
          await supabase.from('email_log').insert({ candidate_id: candidate.id, application_id: interview.application.id, type: 'interview_reminder' })
        }
      }

      const panelists = (interview.panel ?? []).map((p: { user: { id: string; name: string; email: string } }) => p.user).filter(Boolean)
      for (const panelist of panelists) {
        await supabase.from('notifications').insert({
          user_id: panelist.id,
          type: 'reminder',
          reference_id: interview.application?.id ?? null,
          message: `Reminder: you're interviewing ${candidate?.name ?? 'a candidate'} for ${job?.title ?? 'a role'}${stageName ? ` (${stageName})` : ''} on ${when}.`,
        })
        results.panelist_notifications += 1

        if (panelist.email) {
          const html = `<p>Hi ${panelist.name},</p><p>Reminder — you're on the panel for <strong>${candidate?.name ?? 'a candidate'}</strong>'s interview for <strong>${job?.title ?? 'this role'}</strong>${
            stageName ? ` (${stageName} stage)` : ''
          } on <strong>${when}</strong>.</p><p><a href="${siteUrl}/dashboard/interviews">View in the HR Interview Portal</a></p>`
          const sent = await sendEmail(panelist.email, `Reminder: interview for ${job?.title ?? 'a role'} on ${when}`, html)
          if (sent) results.panelist_emails_sent += 1
        }
      }

      await supabase.from('interviews').update({ reminder_sent_at: new Date().toISOString() }).eq('id', interview.id)
      results.interviews_processed += 1
    } catch (err) {
      results.failed.push({ interview_id: interview.id, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return json(results, 200)
})
