import { supabase } from './supabaseClient'

export const STAGES = ['new', 'screening', 'shortlisted', 'interview', 'offer', 'hired', 'rejected']

// Includes candidate.resume_parsed and the job's requirement fields so
// the keyword match score (Section "ATS ranking") can be computed
// client-side without a second round trip.
const APPLICATION_SELECT =
  '*, candidate:candidates(id,name,email,phone,resume_url,source,resume_parsed), job:jobs(id,title,description,requirements,requirements_list,scorecard_template)'

export async function listApplications(filters = {}) {
  let query = supabase.from('applications').select(APPLICATION_SELECT)

  if (filters.jobId) query = query.eq('job_id', filters.jobId)
  if (filters.stage) query = query.eq('stage', filters.stage)
  if (filters.assignedTo === 'unassigned') query = query.is('assigned_to', null)
  else if (filters.assignedTo) query = query.eq('assigned_to', filters.assignedTo)
  if (filters.tag) query = query.contains('tags', [filters.tag])
  if (filters.minScore !== undefined && filters.minScore !== '') {
    query = query.gte('score', Number(filters.minScore))
  }
  if (filters.minRating !== undefined && filters.minRating !== '') {
    query = query.gte('rating', Number(filters.minRating))
  }

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getApplication(id) {
  const { data, error } = await supabase
    .from('applications')
    .select(APPLICATION_SELECT)
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function listApplicationsForCandidate(candidateId) {
  const { data, error } = await supabase
    .from('applications')
    .select('*, job:jobs(id,title,department,description,requirements,requirements_list,scorecard_template)')
    .eq('candidate_id', candidateId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function updateApplication(id, patch) {
  const { data, error } = await supabase
    .from('applications')
    .update(patch)
    .eq('id', id)
    .select(APPLICATION_SELECT)
    .single()
  if (error) throw error
  return data
}

// Backs the candidate comparison view (Section 6/9, item 22).
export async function listApplicationsByIds(ids) {
  const { data, error } = await supabase.from('applications').select(APPLICATION_SELECT).in('id', ids)
  if (error) throw error
  return data
}

// Runs the rule-based CV analysis (src/lib/cvAnalysis.js) against a
// candidate's parsed resume text and saves the report + suggested
// questions onto the application. Manual/on-demand from the candidate
// detail page's "Analyze CV" button.
export async function analyzeCvForApplication(applicationId) {
  const { analyzeCv, suggestQuestions } = await import('./cvAnalysis')
  const { listQuestions } = await import('./questionLibrary')

  const application = await getApplication(applicationId)
  const resumeText = application.candidate?.resume_parsed?.text || ''
  const report = analyzeCv(resumeText)

  let libraryQuestions = []
  try {
    libraryQuestions = await listQuestions({ roleCategory: application.job?.title })
  } catch (err) {
    console.error('question library lookup failed during CV analysis', err)
  }
  report.suggestedQuestions = suggestQuestions(report, libraryQuestions)

  return updateApplication(applicationId, { cv_report: report, cv_analyzed_at: new Date().toISOString() })
}

export async function listStaffUsers() {
  const { data, error } = await supabase.from('users').select('id, name, role').order('name')
  if (error) throw error
  return data
}
