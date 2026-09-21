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

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

// Generates a unique, human-readable slug for the apply link (e.g.
// "sales-officer", or "sales-officer-2" if that's taken). Kept stable
// after creation — jobs.js never regenerates it on update — so a link
// someone already shared doesn't break if the title changes later.
async function generateUniqueSlug(title) {
  const base = slugify(title) || 'job'
  const { data, error } = await supabase.from('jobs').select('slug').like('slug', `${base}%`)
  if (error) throw error

  const taken = new Set(data.map((row) => row.slug))
  if (!taken.has(base)) return base

  let n = 2
  while (taken.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

export async function createJob(payload, createdBy) {
  const slug = await generateUniqueSlug(payload.title)
  const { data, error } = await supabase
    .from('jobs')
    .insert({ ...payload, slug, created_by: createdBy })
    .select()
    .single()

  if (error) throw error

  // Seed the job's default 3-stage interview process. Best-effort: a
  // failure here shouldn't undo job creation — HR can add stages
  // manually from the job's interview-stages editor if this fails.
  try {
    const { seedDefaultStages } = await import('./interviews')
    await seedDefaultStages(data.id)
  } catch (err) {
    console.error('default interview stage seeding failed', err)
  }

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
