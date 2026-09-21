import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getOpenJob, submitApplication } from '../../lib/apply'
import { uploadResume, validateResumeFile } from '../../lib/resumeStorage'
import JobPageContent from '../../components/JobPageContent'
import { PublicShell } from '../../components/PublicShell'

const inputStyle = {
  padding: '11px 13px',
  border: '1px solid #E1E6EF',
  borderRadius: 9,
  fontSize: 14,
  fontFamily: 'inherit',
  width: '100%',
  background: '#F9FAFC',
}

const cardStyle = {
  background: '#fff',
  border: '1px solid #E7EBF1',
  borderRadius: 16,
  boxShadow: '0 1px 2px rgba(15,23,42,0.03), 0 8px 24px rgba(15,23,42,0.04)',
}

const labelStyle = { fontSize: 12.5, fontWeight: 700, color: '#475569' }

function DynamicField({ field, value, onChange }) {
  const common = {
    style: inputStyle,
    required: field.required,
    value: value ?? '',
    onChange: (e) => onChange(e.target.value),
  }
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={labelStyle}>
        {field.label}
        {field.required ? ' *' : ' (optional)'}
      </span>
      {field.type === 'textarea' ? (
        <textarea rows={3} {...common} />
      ) : (
        <input
          type={field.type === 'url' ? 'url' : field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
          {...common}
        />
      )}
    </label>
  )
}

export default function ApplyPage() {
  const { jobId } = useParams()
  const navigate = useNavigate()

  const [job, setJob] = useState(null)
  const [loadError, setLoadError] = useState(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [portfolioUrl, setPortfolioUrl] = useState('')
  const [customValues, setCustomValues] = useState({})

  const [file, setFile] = useState(null)
  const [fileError, setFileError] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [parsedFields, setParsedFields] = useState(null)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  useEffect(() => {
    getOpenJob(jobId)
      .then(setJob)
      .catch(() => setLoadError('This job posting is not available.'))
  }, [jobId])

  // Granular source tracking (Reports > Source tracking): captured
  // once on load so it survives the candidate filling out the form,
  // not read again at submit time.
  const [sourceDetail] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign']
    const pairs = utmKeys.filter((k) => params.get(k)).map((k) => `${k}=${params.get(k)}`)
    return pairs.length > 0 ? pairs.join('&') : (document.referrer ? `referrer=${document.referrer}` : null)
  })

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
    setParsing(true)
    try {
      const { parseResume } = await import('../../lib/resumeParser')
      const parsed = await parseResume(selected)
      setParsedFields(parsed)
      // Pre-fill only empty fields — never override what the candidate
      // already typed.
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

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitError(null)

    if (!file) {
      setFileError('Please attach your resume')
      return
    }

    setSubmitting(true)
    try {
      const resumePath = await uploadResume(file)
      const result = await submitApplication({
        job_id: job.id,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        portfolio_url: portfolioUrl.trim() || null,
        resume_path: resumePath,
        resume_parsed: parsedFields,
        custom_field_responses: customValues,
        source_detail: sourceDetail,
      })
      navigate(`/status/${result.status_token}`)
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loadError) {
    return (
      <PublicShell maxWidth={560}>
        <div style={{ ...cardStyle, padding: 40, textAlign: 'center' }}>
          <h1 style={{ fontSize: 18, margin: '0 0 12px' }}>{loadError}</h1>
          <Link to="/apply" style={{ fontSize: 14, color: '#48418A', fontWeight: 700, textDecoration: 'none' }}>
            ← View all open positions
          </Link>
        </div>
      </PublicShell>
    )
  }

  if (!job) {
    return (
      <PublicShell>
        <div style={{ fontSize: 13, color: '#94A3B8' }}>Loading&hellip;</div>
      </PublicShell>
    )
  }

  function scrollToForm() {
    document.getElementById('apply-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <PublicShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ ...cardStyle, padding: '32px 36px' }}>
          <JobPageContent job={job} onApply={scrollToForm} />
        </div>

        <div style={{ ...cardStyle, padding: '32px 36px' }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>Apply for this role</div>
            <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 3 }}>
              Takes about two minutes. No account needed.
            </div>
          </div>

          <form id="apply-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={labelStyle}>Full name *</span>
                <input required style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={labelStyle}>Email *</span>
                <input required type="email" style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={labelStyle}>Phone (optional)</span>
                <input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={labelStyle}>Portfolio link (optional)</span>
                <input type="url" style={inputStyle} value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} />
              </label>
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={labelStyle}>Resume * (PDF or DOCX, max 5MB)</span>
              <div
                style={{
                  border: '1.5px dashed #C7D2E5',
                  borderRadius: 10,
                  padding: '16px 14px',
                  background: '#F9FAFC',
                  marginTop: 2,
                }}
              >
                <input type="file" accept=".pdf,.docx" onChange={handleFileChange} style={{ fontSize: 13, width: '100%' }} />
              </div>
              {parsing && <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>Reading resume&hellip;</div>}
              {fileError && <div style={{ fontSize: 12, color: '#EF4444', marginTop: 2 }}>{fileError}</div>}
            </label>

            {job.custom_fields?.map((field) => (
              <DynamicField
                key={field.label}
                field={field}
                value={customValues[field.label]}
                onChange={(value) => setCustomValues((v) => ({ ...v, [field.label]: value }))}
              />
            ))}

            {submitError && (
              <div style={{ fontSize: 13, color: '#EF4444', background: '#FDEAEA', border: '1px solid #FBD5D5', borderRadius: 8, padding: 10 }}>
                {submitError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{
                background: 'linear-gradient(135deg, #48418A, #3F3D69)',
                color: '#fff',
                fontWeight: 700,
                fontSize: 14.5,
                padding: '13px 20px',
                borderRadius: 10,
                border: 'none',
                cursor: submitting ? 'default' : 'pointer',
                opacity: submitting ? 0.7 : 1,
                boxShadow: '0 6px 16px rgba(14,135,254,0.28)',
              }}
            >
              {submitting ? 'Submitting…' : 'Submit application'}
            </button>
            <div style={{ fontSize: 11.5, color: '#94A3B8', textAlign: 'center' }}>
              By applying you agree your resume and details will be shared with our hiring team.
              See our <Link to="/privacy" style={{ color: '#3F3D69', fontWeight: 600 }}>privacy notice</Link>.
            </div>
          </form>
        </div>
      </div>
    </PublicShell>
  )
}
