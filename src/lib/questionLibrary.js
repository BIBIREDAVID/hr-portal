import { supabase } from './supabaseClient'

export async function listQuestions({ roleCategory, stageName } = {}) {
  let query = supabase.from('question_library').select('*')
  if (roleCategory) query = query.eq('role_category', roleCategory)
  if (stageName) query = query.eq('stage_name', stageName)
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function listRoleCategories() {
  const { data, error } = await supabase.from('question_library').select('role_category')
  if (error) throw error
  return [...new Set(data.map((row) => row.role_category))].sort()
}

export async function createQuestion({ roleCategory, stageName, questionText, isDefaultForRole, createdBy }) {
  const { data, error } = await supabase
    .from('question_library')
    .insert({
      role_category: roleCategory,
      stage_name: stageName || null,
      question_text: questionText,
      is_default_for_role: !!isDefaultForRole,
      created_by: createdBy,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateQuestion(id, patch) {
  const { data, error } = await supabase.from('question_library').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteQuestion(id) {
  const { error } = await supabase.from('question_library').delete().eq('id', id)
  if (error) throw error
}

// Questions already attached to a stage, in display order.
export async function listStageQuestions(stageId) {
  const { data, error } = await supabase
    .from('stage_questions')
    .select('order_index, question:question_library(*)')
    .eq('stage_id', stageId)
    .order('order_index', { ascending: true })
  if (error) throw error
  return data.map((row) => row.question)
}

export async function attachQuestionToStage(stageId, questionId, orderIndex = 0) {
  const { error } = await supabase
    .from('stage_questions')
    .insert({ stage_id: stageId, question_id: questionId, order_index: orderIndex })
  if (error) throw error
}

export async function detachQuestionFromStage(stageId, questionId) {
  const { error } = await supabase
    .from('stage_questions')
    .delete()
    .eq('stage_id', stageId)
    .eq('question_id', questionId)
  if (error) throw error
}
