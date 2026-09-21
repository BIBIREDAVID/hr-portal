// Sends a best-effort "you've been assigned to interview..." email to
// each newly-added interview panelist, logs an activity_log row, and
// creates an in-app notification per interviewer. The client inserts the
// `interview_panel` rows itself (RLS-permitted for admin/recruiter,
// consistent with how the rest of the app writes normal rows) and then
// calls this function purely for these side effects — modeled directly
// on invite-staff's best-effort email block and send-email's caller
// auth-check.
//
// Deploy with: supabase functions deploy notify-interview-assignment
// Requires: RESEND_API_KEY, EMAIL_FROM_ADDRESS, PUBLIC_SITE_URL secrets
// (same as send-email/invite-staff), plus SUPABASE_SERVICE_ROLE_KEY.

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

  const { data: callerStaff, error: callerStaffError } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', authData.user.id)
    .maybeSingle()

  if (callerStaffError) return json({ error: callerStaffError.message }, 500)
  if (!callerStaff || !['admin', 'recruiter'].includes(callerStaff.role)) {
    return json({ error: 'Not authorized' }, 403)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const interviewId = String(body.interview_id ?? '')
  const userIds = Array.isArray(body.user_ids) ? body.user_ids.map(String) : []
  if (!interviewId || userIds.length === 0) {
    return json({ error: 'interview_id and user_ids are required' }, 400)
  }

  const { data: interview, error: interviewError } = await supabase
    .from('interviews')
    .select(
      'id, scheduled_at, external_link, stage:job_interview_stages(name), application:applications(id,candidate:candidates(id,name),job:jobs(id,title))'
    )
    .eq('id', interviewId)
    .maybeSingle()

  if (interviewError) return json({ error: interviewError.message }, 500)
  if (!interview) return json({ error: 'Interview not found' }, 404)

  const { data: interviewers, error: usersError } = await supabase
    .from('users')
    .select('id, name, email')
    .in('id', userIds)

  if (usersError) return json({ error: usersError.message }, 500)

  const resendKey = Deno.env.get('RESEND_API_KEY')
  const fromAddress = Deno.env.get('EMAIL_FROM_ADDRESS')
  const siteUrl = Deno.env.get('PUBLIC_SITE_URL') ?? ''

  const candidateName = interview.application?.candidate?.name ?? 'the candidate'
  const jobTitle = interview.application?.job?.title ?? 'this role'
  const stageName = interview.stage?.name
  const when = interview.scheduled_at
    ? new Date(interview.scheduled_at as string).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'a time to be confirmed'

  const results = { notified: 0, email_sent: 0, failed: [] as { user_id: string; error: string }[] }

  for (const interviewer of interviewers ?? []) {
    try {
      await supabase.from('notifications').insert({
        user_id: interviewer.id,
        type: 'assignment',
        reference_id: interview.application?.id ?? null,
        message: `You've been assigned to interview ${candidateName} for ${jobTitle}${stageName ? ` (${stageName})` : ''}.`,
      })
      results.notified += 1

      if (resendKey && fromAddress) {
        const html = `<p>Hi ${interviewer.name},</p><p>You've been assigned to interview <strong>${candidateName}</strong> for <strong>${jobTitle}</strong>${
          stageName ? ` — <strong>${stageName}</strong> stage` : ''
        }.</p><p>Scheduled for: ${when}</p>${
          interview.external_link ? `<p>Link: <a href="${interview.external_link}">${interview.external_link}</a></p>` : ''
        }<p><a href="${siteUrl}/dashboard/interviews">View in the HR Interview Portal</a></p>`

        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromAddress,
            to: interviewer.email,
            subject: `Interview assignment: ${candidateName} — ${jobTitle}`,
            html,
          }),
        })

        if (!emailRes.ok) {
          console.error('assignment email rejected', emailRes.status, await emailRes.text())
        } else {
          results.email_sent += 1
        }
      }
    } catch (err) {
      results.failed.push({ user_id: interviewer.id, error: err instanceof Error ? err.message : String(err) })
    }
  }

  if (interview.application?.id) {
    await supabase.from('activity_log').insert({
      application_id: interview.application.id,
      actor_id: callerStaff.id,
      action: `Assigned ${(interviewers ?? []).map((i) => i.name).join(', ')} to interview`,
    })
  }

  return json(results, 200)
})
