import { supabase } from './supabaseClient'

export async function getCandidate(id) {
  const { data, error } = await supabase.from('candidates').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

// Duplicate detection by email/phone (Section 6), for the HR manual
// upload flow — mirrors the check the public `apply` Edge Function does.
export async function findDuplicateCandidate({ email, phone }) {
  const filter = phone ? `email.ilike.${email},phone.eq.${phone}` : `email.ilike.${email}`
  const { data, error } = await supabase.from('candidates').select('*').or(filter).limit(1).maybeSingle()
  if (error) throw error
  return data
}

export async function createCandidate(payload) {
  const { data, error } = await supabase
    .from('candidates')
    .insert({ ...payload, source: 'hr_upload' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCandidate(id, payload) {
  const { data, error } = await supabase.from('candidates').update(payload).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function createApplication({ candidateId, jobId, customFieldResponses = {} }) {
  const { data, error } = await supabase
    .from('applications')
    .insert({ candidate_id: candidateId, job_id: jobId, custom_field_responses: customFieldResponses })
    .select()
    .single()
  if (error) throw error
  return data
}
