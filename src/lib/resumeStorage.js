import { supabase } from './supabaseClient'

export const RESUME_MAX_BYTES = 5 * 1024 * 1024 // 5MB, per Section 8
export const RESUME_ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

export function validateResumeFile(file) {
  if (!RESUME_ALLOWED_TYPES.includes(file.type)) {
    return 'Please upload a PDF or DOCX file'
  }
  if (file.size > RESUME_MAX_BYTES) {
    return 'File is too large — max 5MB'
  }
  return null
}

// Uploads to the private `resumes` bucket under a random path so
// candidates can't enumerate or overwrite each other's files. Returns
// the storage object path (not a public URL — the bucket isn't public).
export async function uploadResume(file) {
  const ext = file.name.split('.').pop()
  const path = `${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from('resumes').upload(path, file, {
    contentType: file.type,
    upsert: false,
  })

  if (error) throw error
  return path
}

// Resumes live in a private bucket (Section 8) — HR views them via a
// short-lived signed URL rather than a public one. Requires the
// `resumes_staff_read` storage policy (admin/recruiter only).
export async function getResumeSignedUrl(path, expiresInSeconds = 600) {
  const { data, error } = await supabase.storage.from('resumes').createSignedUrl(path, expiresInSeconds)
  if (error) throw error
  return data.signedUrl
}
