import { supabase } from './supabaseClient'

// Staff side: authenticated, RLS-checked, direct table access.
export async function listSlotsForApplication(applicationId) {
  const { data, error } = await supabase
    .from('interview_slots')
    .select('id, starts_at, duration_minutes, status, interviewer:users!interview_slots_interviewer_id_fkey(id,name)')
    .eq('application_id', applicationId)
    .order('starts_at', { ascending: true })
  if (error) throw error
  return data
}

export async function proposeSlots({ applicationId, interviewerId, createdBy, times, durationMinutes }) {
  const rows = times.map((startsAt) => ({
    application_id: applicationId,
    interviewer_id: interviewerId || null,
    starts_at: startsAt,
    duration_minutes: durationMinutes,
    created_by: createdBy,
  }))
  const { data, error } = await supabase.from('interview_slots').insert(rows).select()
  if (error) throw error
  return data
}

export async function cancelSlot(id) {
  const { error } = await supabase.from('interview_slots').update({ status: 'cancelled' }).eq('id', id)
  if (error) throw error
}

// Candidate side: no account, so this goes through the `scheduling`
// Edge Function, which validates status_token server-side — same
// pattern as chat.js.
export async function listOpenSlotsAsCandidate({ statusToken, applicationId }) {
  const { data, error } = await supabase.functions.invoke('scheduling', {
    body: { status_token: statusToken, application_id: applicationId, action: 'list' },
  })
  if (error) throw new Error((await error.context?.json?.().catch(() => null))?.error || error.message)
  return data.slots
}

export async function bookSlotAsCandidate({ statusToken, applicationId, slotId }) {
  const { data, error } = await supabase.functions.invoke('scheduling', {
    body: { status_token: statusToken, application_id: applicationId, action: 'book', slot_id: slotId },
  })
  if (error) throw new Error((await error.context?.json?.().catch(() => null))?.error || error.message)
  return data.interview
}
