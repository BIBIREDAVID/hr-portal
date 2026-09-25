import { supabase } from './supabaseClient'

// interview_panel's many-to-many path to `users` collides with the direct
// interviewer_id FK unless disambiguated — see PGRST201 ("more than one
// relationship was found for 'interviews' and 'users'").
const INTERVIEW_SELECT =
  '*, interviewer:users!interviews_interviewer_id_fkey(id,name), stage:job_interview_stages(id,name,order_index,criteria), panel:interview_panel(user:users(id,name))'

// RLS scopes this automatically (Phase 1/6): admin/recruiter see every
// interview on the application; an interviewer only sees interviews
// they're a panel member on.
export async function listInterviewsForApplication(applicationId) {
  const { data, error } = await supabase
    .from('interviews')
    .select(INTERVIEW_SELECT)
    .eq('application_id', applicationId)
    .order('scheduled_at', { ascending: true })
  if (error) throw error
  return data
}

// For the /dashboard/interviews overview — RLS again does the scoping,
// so an interviewer calling this only ever gets their own rows back.
export async function listInterviews() {
  const { data, error } = await supabase
    .from('interviews')
    .select(
      `${INTERVIEW_SELECT}, application:applications(id,candidate:candidates(id,name),job:jobs(id,title))`
    )
    .order('scheduled_at', { ascending: true })
  if (error) throw error
  return data
}

export async function createInterview(payload) {
  const { data, error } = await supabase.from('interviews').insert(payload).select(INTERVIEW_SELECT).single()
  if (error) throw error
  return data
}

export async function updateInterview(id, patch) {
  const { data, error } = await supabase.from('interviews').update(patch).eq('id', id).select(INTERVIEW_SELECT).single()
  if (error) throw error
  return data
}

// Manually fires the same reminder sweep pg_cron runs every 15 minutes
// (see migration 0011 + supabase/functions/send-interview-reminders) —
// exposed as a dashboard button so HR can trigger it on demand (e.g. to
// demo the feature, or if the schedule wasn't enabled on this project).
// Safe to call repeatedly: interviews already reminded about are skipped
// via `reminder_sent_at`.
export async function sendInterviewRemindersNow() {
  const { data, error } = await supabase.functions.invoke('send-interview-reminders', { body: {} })
  if (error) {
    const message = await error.context?.json?.().then((b) => b?.error).catch(() => null)
    throw new Error(message || error.message)
  }
  return data
}

// -------------------------------------------------------------------
// Interview stages (per job)
// -------------------------------------------------------------------

export async function listStagesForJob(jobId) {
  const { data, error } = await supabase
    .from('job_interview_stages')
    .select('*')
    .eq('job_id', jobId)
    .order('order_index', { ascending: true })
  if (error) throw error
  return data
}

const DEFAULT_STAGE_NAMES = ['Screening', 'Technical', 'Final']

// Seeds a job's 3 default stages. Called once from createJob — safe to
// call again (e.g. from a "reset stages" action) since order_index is
// unique per job and will just conflict/no-op on repeats by design.
export async function seedDefaultStages(jobId) {
  const rows = DEFAULT_STAGE_NAMES.map((name, i) => ({
    job_id: jobId,
    name,
    order_index: i + 1,
    criteria: [],
  }))
  const { data, error } = await supabase.from('job_interview_stages').insert(rows).select()
  if (error) throw error
  return data
}

export async function createStage(jobId, { name, orderIndex, criteria = [] }) {
  const { data, error } = await supabase
    .from('job_interview_stages')
    .insert({ job_id: jobId, name, order_index: orderIndex, criteria })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateStage(id, patch) {
  const { data, error } = await supabase.from('job_interview_stages').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteStage(id) {
  const { error } = await supabase.from('job_interview_stages').delete().eq('id', id)
  if (error) throw error
}

// -------------------------------------------------------------------
// Interview panel (multiple interviewers per interview)
// -------------------------------------------------------------------

export async function listPanelForInterview(interviewId) {
  const { data, error } = await supabase
    .from('interview_panel')
    .select('user:users(id,name,email)')
    .eq('interview_id', interviewId)
  if (error) throw error
  return data.map((row) => row.user)
}

// Adds panelists and (best-effort) triggers the assignment email/
// notification via the Edge Function. Throws only on the panel insert
// itself — a failure to notify is logged by the function, not the caller.
export async function assignPanel(interviewId, userIds) {
  if (!userIds?.length) return
  const rows = userIds.map((userId) => ({ interview_id: interviewId, user_id: userId }))
  const { error } = await supabase.from('interview_panel').insert(rows)
  if (error) throw error

  try {
    const { error: fnError } = await supabase.functions.invoke('notify-interview-assignment', {
      body: { interview_id: interviewId, user_ids: userIds },
    })
    if (fnError) throw fnError
  } catch (err) {
    console.error('interview assignment notification failed', err)
  }
}

export async function removeFromPanel(interviewId, userId) {
  const { error } = await supabase
    .from('interview_panel')
    .delete()
    .eq('interview_id', interviewId)
    .eq('user_id', userId)
  if (error) throw error
}

// -------------------------------------------------------------------
// Interview scores (per panelist, per criterion)
// -------------------------------------------------------------------

export async function listScoresForInterview(interviewId) {
  const { data, error } = await supabase
    .from('interview_scores')
    .select('*, interviewer:users(id,name)')
    .eq('interview_id', interviewId)
  if (error) throw error
  return data
}

// Upserts one panelist's score for one criterion (unique on
// interview_id/interviewer_id/criterion_label lets us use upsert here).
export async function recordScore({ interviewId, interviewerId, criterionLabel, score, notes }) {
  const { data, error } = await supabase
    .from('interview_scores')
    .upsert(
      { interview_id: interviewId, interviewer_id: interviewerId, criterion_label: criterionLabel, score, notes },
      { onConflict: 'interview_id,interviewer_id,criterion_label' }
    )
    .select()
    .single()
  if (error) throw error
  return data
}

// Averages every panelist's score per criterion — used to render a
// combined view alongside each individual's scores.
export function averageScoresByCriterion(scores) {
  const byCriterion = {}
  for (const s of scores) {
    if (s.score === null || s.score === undefined) continue
    if (!byCriterion[s.criterion_label]) byCriterion[s.criterion_label] = []
    byCriterion[s.criterion_label].push(Number(s.score))
  }
  return Object.fromEntries(
    Object.entries(byCriterion).map(([label, values]) => [
      label,
      values.reduce((a, b) => a + b, 0) / values.length,
    ])
  )
}
