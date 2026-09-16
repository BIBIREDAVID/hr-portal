import { supabase } from './supabaseClient'

export async function listTodos(userId) {
  const { data, error } = await supabase
    .from('hr_todos')
    .select('*')
    .eq('user_id', userId)
    .order('completed', { ascending: true })
    .order('due_at', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data
}

export async function createTodo({ userId, title, dueAt }) {
  const { data, error } = await supabase
    .from('hr_todos')
    .insert({ user_id: userId, title, due_at: dueAt || null })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateTodo(id, patch) {
  const { data, error } = await supabase.from('hr_todos').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteTodo(id) {
  const { error } = await supabase.from('hr_todos').delete().eq('id', id)
  if (error) throw error
}
