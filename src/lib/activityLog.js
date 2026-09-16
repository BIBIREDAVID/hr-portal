import { supabase } from './supabaseClient'

export async function listActivityForApplication(applicationId) {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*, actor:users(id,name)')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// Fire-and-forget by design (mirrors maybeSendStageChangeEmail): the
// audit trail is a record of what happened, not a gate on whether it's
// allowed to happen — a logging failure shouldn't undo or block the
// action that triggered it.
export async function logActivity({ applicationId, actorId, action }) {
  try {
    const { error } = await supabase.from('activity_log').insert({
      application_id: applicationId,
      actor_id: actorId,
      action,
    })
    if (error) throw error
  } catch (err) {
    console.error('activity log write failed', err)
  }
}
