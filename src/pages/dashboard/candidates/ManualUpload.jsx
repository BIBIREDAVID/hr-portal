import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listJobs } from '../../../lib/jobs'
import { createApplication, createCandidate, findDuplicateCandidate, updateCandidate } from '../../../lib/candidates'
import { uploadResume, validateResumeFile } from '../../../lib/resumeStorage'
import { logActivity } from '../../../lib/activityLog'
import { useAuth } from '../../../lib/AuthContext'

const inputStyle = {
  padding: '9px 11px',
  border: '1px solid #E7EBF1',
  borderRadius: 8,
  fontSize: 14,
  fontFamily: 'inherit',
  width: '100%',
}

const labelStyle = { fontSize: 12.5, fontWeight: 600, color: '#475569' }

export default function ManualUpload() {
  const navigate = useNavigate()
  const { staffUser } = useAuth()
  const [jobs, setJobs] = useState([])
  const [jobId, setJobId] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [portfolioUrl, setPortfolioUrl] = useState('')
  const [file, setFile] = useState(null)
  const [fileError, setFileError] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [parsedFields, setParsedFields] = useState(null)
  const [duplicate, setDuplicate] = useState(null)
  const [checkingDuplicate, setCheckingDuplicate] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    listJobs().then(setJobs).catch(() => {})
  }, [])

  async function handleFileChange(e) {
    const selected = e.target.files?.[0]
    if (!selected) return
    const validationError = validateResumeFile(selected)
    if (validationError) {
      setFile(null)
      setFileError(validationError)
      return
    }
    setFile(selected)
    setFileError(null)
    setParsedFields(null)
    setParsing(true)
    try {
      const { parseResume } = await import('../../../lib/resumeParser')
      const parsed = await parseResume(selected)
      setParsedFields(parsed)
      // Same rule as the public apply form: pre-fill only what's still
      // empty — never override what HR already typed.
      setName((current) => current || parsed.name || '')
      setEmail((current) => current || parsed.email || '')
      setPhone((current) => current || parsed.phone || '')
    } catch {
      // Parsing is a nice-to-have; silently skip pre-fill on failure.
      setParsedFields(null)
    } finally {
      setParsing(false)
    }
  }

  async function handleEmailBlur() {
    setDuplicate(null)
    if (!email.trim()) return
    setCheckingDuplicate(true)
    try {
      const existing = await findDuplicateCandidate({ email: email.trim(), phone: phone.trim() || null })
      setDuplicate(existing)
    } catch {
      // non-fatal — duplicate check is a convenience, not a hard gate
    } finally {
      setCheckingDuplicate(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!jobId) {
      setError('Please select a job')
      return
    }
    if (!file) {
      setFileError('Please attach a resume')
      return
    }

    setSubmitting(true)
    try {
      const resumePath = await uploadResume(file)

      let candidate
      if (duplicate) {
        candidate = await updateCandidate(duplicate.id, {
          name: name.trim(),
          phone: phone.trim() || null,
          resume_url: resumePath,
          resume_parsed: parsedFields,
          portfolio_url: portfolioUrl.trim() || null,
        })
      } else {
        candidate = await createCandidate({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || null,
          resume_url: resumePath,
          resume_parsed: parsedFields,
          portfolio_url: portfolioUrl.trim() || null,
        })
      }

      const application = await createApplication({ candidateId: candidate.id, jobId })
      logActivity({ applicationId: application.id, actorId: staffUser.id, action: 'added this candidate via HR upload' })
      navigate(`/dashboard/candidates/${candidate.id}`)
    } catch (err) {
      if (err.code === '23505') {
        setError('This candidate has already applied to that job.')
      } else {
        setError(err.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 560 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 20px' }}>Add candidate</h1>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={labelStyle}>Job</span>
          <select required style={inputStyle} value={jobId} onChange={(e) => setJobId(e.target.value)}>
            <option value="" disabled>
              Select a job
            </option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title} ({j.status})
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={labelStyle}>Full name</span>
          <input required style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={labelStyle}>Email</span>
          <input
            required
            type="email"
            style={inputStyle}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={handleEmailBlur}
          />
        </label>

        {checkingDuplicate && <div style={{ fontSize: 12, color: '#94A3B8' }}>Checking for existing candidate&hellip;</div>}
        {duplicate && (
          <div style={{ fontSize: 12.5, color: '#F97316', background: '#FFEEE2', borderRadius: 8, padding: '8px 12px' }}>
            A candidate with this email/phone already exists ({duplicate.name}). Submitting will update their
            details and add this as a new application for them.
          </div>
        )}

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={labelStyle}>Phone (optional)</span>
          <input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} onBlur={handleEmailBlur} />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={labelStyle}>Portfolio link (optional)</span>
          <input type="url" style={inputStyle} value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} />
        </label>

        <div>
          <span style={labelStyle}>Resume (PDF or DOCX, max 5MB)</span>
          <div style={{ marginTop: 6 }}>
            <input type="file" accept=".pdf,.docx" onChange={handleFileChange} />
          </div>
          {parsing && <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>Reading resume&hellip;</div>}
          {fileError && <div style={{ fontSize: 12, color: '#EF4444', marginTop: 4 }}>{fileError}</div>}
        </div>

        {error && <div style={{ fontSize: 13, color: '#EF4444' }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="submit"
            disabled={submitting}
            style={{
              background: '#48418A',
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
              padding: '10px 18px',
              borderRadius: 8,
              border: 'none',
              cursor: submitting ? 'default' : 'pointer',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Saving…' : 'Add candidate'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/dashboard/applications')}
            style={{ background: '#fff', border: '1px solid #E7EBF1', borderRadius: 8, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
