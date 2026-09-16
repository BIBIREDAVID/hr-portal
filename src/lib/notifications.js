import { supabase } from './supabaseClient'

export async function listNotifications(userId, { limit = 30 } = {}) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

export async function markNotificationRead(id) {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id)
  if (error) throw error
}

export async function markAllNotificationsRead(userId) {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
  if (error) throw error
}

// type: 'mention' | 'assignment'. referenceId is an applications.id —
// the notification bell resolves it to a candidate to link to.
export async function createNotification({ userId, type, referenceId, message }) {
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    type,
    reference_id: referenceId,
    message,
  })
  if (error) throw error
}
