import { supabase } from './supabaseClient'

// HR side: authenticated, RLS-checked, direct table access.
export async function listChatMessages(applicationId) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function sendChatMessageAsStaff({ applicationId, senderUserId, body }) {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ application_id: applicationId, sender_type: 'hr', sender_user_id: senderUserId, body })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function markChatReadByHr(applicationId) {
  const { error } = await supabase
    .from('chat_messages')
    .update({ read_by_hr: true })
    .eq('application_id', applicationId)
    .eq('sender_type', 'candidate')
    .eq('read_by_hr', false)
  if (error) throw error
}

// Candidate side: no account, so this goes through the `chat` Edge
// Function, which validates status_token server-side (Section 4/8) —
// never a direct client insert/select with the token as a bare filter.
export async function listChatMessagesAsCandidate({ statusToken, applicationId }) {
  const { data, error } = await supabase.functions.invoke('chat', {
    body: { status_token: statusToken, application_id: applicationId, action: 'list' },
  })
  if (error) throw new Error((await error.context?.json?.().catch(() => null))?.error || error.message)
  return data.messages
}

export async function sendChatMessageAsCandidate({ statusToken, applicationId, body }) {
  const { data, error } = await supabase.functions.invoke('chat', {
    body: { status_token: statusToken, application_id: applicationId, action: 'send', body },
  })
  if (error) throw new Error((await error.context?.json?.().catch(() => null))?.error || error.message)
  return data.message
}
