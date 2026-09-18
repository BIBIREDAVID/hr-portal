import { supabase } from './supabaseClient'

export const STAFF_ROLES = ['admin', 'recruiter', 'interviewer']

export async function listStaff() {
  const { data, error } = await supabase
    .from('users')
    .select('id, auth_id, name, email, role, created_at')
    .order('created_at', { ascending: true })

  if (error) throw error
  return data
}

// Calls the `invite-staff` Edge Function — the only path allowed to
// create a new staff login, since it needs the service role key to
// create the auth.users row. Admin-only, enforced server-side too.
export async function inviteStaff({ name, email, role }) {
  const { data, error } = await supabase.functions.invoke('invite-staff', {
    body: { name, email, role },
  })

  if (error) {
    const message = await error.context?.json?.().then((b) => b?.error).catch(() => null)
    throw new Error(message || error.message)
  }
  return data
}

export async function updateStaffRole(id, role) {
  const { data, error } = await supabase
    .from('users')
    .update({ role })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}
