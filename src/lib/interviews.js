import { supabase } from './supabaseClient'

const INTERVIEW_SELECT = '*, interviewer:users(id,name)'

// RLS scopes this automatically (Phase 1/6): admin/recruiter see every
// interview on the application; an interviewer only sees their own.
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
    .select('*, interviewer:users(id,name), application:applications(id,candidate:candidates(id,name),job:jobs(id,title))')
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
