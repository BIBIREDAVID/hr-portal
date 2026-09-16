import { supabase } from './supabaseClient'

export async function listNotesForApplication(applicationId) {
  const { data, error } = await supabase
    .from('notes')
    .select('*, author:users(id,name)')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function createNote({ applicationId, authorId, body, mentionedUserIds }) {
  const { data, error } = await supabase
    .from('notes')
    .insert({
      application_id: applicationId,
      author_id: authorId,
      body,
      mentioned_user_ids: mentionedUserIds,
    })
    .select('*, author:users(id,name)')
    .single()
  if (error) throw error
  return data
}

// Matches "@Full Name" segments against known staff names — the
// no-AI, regex-based approach the spec calls for elsewhere (Section 2).
// Longer names are checked first so "@Jane Doe" doesn't get eaten by a
// coincidental "@Jane".
export function parseMentions(text, staffUsers) {
  const sorted = [...staffUsers].sort((a, b) => b.name.length - a.name.length)
  const mentioned = new Set()
  for (const user of sorted) {
    const pattern = new RegExp(`@${user.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (pattern.test(text)) mentioned.add(user.id)
  }
  return [...mentioned]
}
