import { supabase } from './supabaseClient'

export async function listJobs() {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function getJob(id) {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function createJob(payload, createdBy) {
  const { data, error } = await supabase
    .from('jobs')
    .insert({ ...payload, created_by: createdBy })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateJob(id, payload) {
  const { data, error } = await supabase
    .from('jobs')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// Applicant count per job, for the Jobs list. Counted client-side from
// job_id alone (no aggregate RPC) — fine at this scale, same approach
// used in reports.js.
export async function getApplicantCountsByJob() {
  const { data, error } = await supabase.from('applications').select('job_id')
  if (error) throw error
  return data.reduce((counts, row) => {
    counts[row.job_id] = (counts[row.job_id] ?? 0) + 1
    return counts
  }, {})
}

export async function deleteJob(id) {
  const { error } = await supabase.from('jobs').delete().eq('id', id)
  if (error) throw error
}

// Job page builder hero image — `job-assets` is a PUBLIC bucket (unlike
// resumes), so the returned URL renders directly on the public job page
// with no signed-URL step.
export async function uploadJobHeroImage(file) {
  const ext = file.name.split('.').pop()
  const path = `${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from('job-assets').upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) throw error

  return supabase.storage.from('job-assets').getPublicUrl(path).data.publicUrl
}
