import { supabase } from './supabaseClient'

// Public careers listing — RLS (jobs_public_read_open) already restricts
// anon reads to status = 'open', but filtering explicitly here too keeps
// the query's intent obvious and avoids relying solely on RLS for it.
export async function getOpenJobs() {
  const { data, error } = await supabase
    .from('jobs')
    .select('id, slug, title, department, headline, locations, work_mode, created_at')
    .eq('status', 'open')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Accepts either the pretty slug (e.g. "sales-officer") or the raw job
// id, so links shared before slugs existed keep working.
export async function getOpenJob(key) {
  const column = UUID_RE.test(key) ? 'id' : 'slug'
  const { data, error } = await supabase
    .from('jobs')
    .select(
      'id, slug, title, department, description, requirements, custom_fields, status, expires_at, headline, hero_image_url, benefits, tasks, requirements_list, locations, work_mode'
    )
    .eq(column, key)
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
