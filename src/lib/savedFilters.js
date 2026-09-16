import { supabase } from './supabaseClient'

export async function listSavedFilters(userId) {
  const { data, error } = await supabase
    .from('saved_filters')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function createSavedFilter({ userId, name, filterConfig }) {
  const { data, error } = await supabase
    .from('saved_filters')
    .insert({ user_id: userId, name, filter_config: filterConfig })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteSavedFilter(id) {
  const { error } = await supabase.from('saved_filters').delete().eq('id', id)
  if (error) throw error
}
