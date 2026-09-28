import { supabase } from './supabaseClient'

export async function getCandidate(id) {
  const { data, error } = await supabase.from('candidates').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

// Duplicate detection by email/phone (Section 6), for the HR manual
// upload flow — mirrors the check the public `apply` Edge Function does.
//
// `_` and `%` are escaped so the case-insensitive match is exact — left
// raw, ilike treats them as wildcards and "a_b@x.com" would match
// "aXb@x.com", a different person. Email and phone are separate queries
// rather than one .or() string, so neither value can break the filter
// syntax.
function escapeLike(value) {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`)
}

export async function findDuplicateCandidate({ email, phone }) {
  const trimmedEmail = email?.trim()
  if (trimmedEmail) {
    const { data, error } = await supabase
      .from('candidates')
      .select('*')
      .ilike('email', escapeLike(trimmedEmail))
      .limit(1)
      .maybeSingle()
    if (error) throw error
    if (data) return data
  }
  const trimmedPhone = phone?.trim()
  if (trimmedPhone) {
    const { data, error } = await supabase.from('candidates').select('*').eq('phone', trimmedPhone).limit(1).maybeSingle()
    if (error) throw error
    if (data) return data
  }
  return null
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
