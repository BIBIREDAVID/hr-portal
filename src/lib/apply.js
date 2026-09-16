import { supabase } from './supabaseClient'

export async function getOpenJob(jobId) {
  const { data, error } = await supabase
    .from('jobs')
    .select(
      'id, title, department, description, requirements, custom_fields, status, expires_at, headline, hero_image_url, benefits, tasks, requirements_list, locations, work_mode'
    )
    .eq('id', jobId)
    .single()

  if (error) throw error
  return data
}

// Calls the `apply` Edge Function — the only path allowed to create
// candidates/applications rows for public submissions (Section 4/8).
export async function submitApplication(payload) {
  const { data, error } = await supabase.functions.invoke('apply', {
    body: payload,
  })

  if (error) {
    // supabase-js surfaces a generic FunctionsHttpError; the function's
    // own JSON error body (if any) is on error.context.
    const message = await error.context?.json?.().then((b) => b?.error).catch(() => null)
    throw new Error(message || error.message)
  }
  return data
}

export async function getApplicationStatus(token) {
  const { data, error } = await supabase.rpc('get_application_status', { p_token: token })
  if (error) throw error
  return data
}
