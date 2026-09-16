import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getOpenJob, submitApplication } from '../../lib/apply'
import { uploadResume, validateResumeFile } from '../../lib/resumeStorage'
import JobPageContent from '../../components/JobPageContent'

const inputStyle = {
  padding: '10px 12px',
  border: '1px solid #E7EBF1',
  borderRadius: 8,
  fontSize: 14,
  fontFamily: 'inherit',
  width: '100%',
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
        job_id: jobId,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        portfolio_url: portfolioUrl.trim() || null,
        resume_path: resumePath,
        resume_parsed: parsedFields,
        custom_field_responses: customValues,
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
      <div style={{ padding: 48, textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: 18 }}>{loadError}</h1>
      </div>
    )
  }

  if (!job) {
    return <div style={{ padding: 48, fontFamily: 'system-ui, sans-serif' }}>Loading&hellip;</div>
  }

  function scrollToForm() {
    document.getElementById('apply-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F6F8FB',
        fontFamily: 'system-ui, sans-serif',
        padding: '48px 24px',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div style={{ width: '100%', maxWidth: 720 }}>
        <div
          style={{
            background: '#fff',
            border: '1px solid #ECEEF3',
            borderRadius: 16,
            boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.06)',
            padding: '48px 40px',
            display: 'flex',
            flexDirection: 'column',
            gap: 26,
          }}
        >
            <JobPageContent job={job} onApply={scrollToForm} />

            <div style={{ height: 1, background: '#E7EBF1' }} />

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

          <div>
            <span style={labelStyle}>Resume * (PDF or DOCX, max 5MB)</span>
            <div style={{ marginTop: 6 }}>
              <input type="file" accept=".pdf,.docx" onChange={handleFileChange} />
            </div>
            {parsing && <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>Reading resume&hellip;</div>}
            {fileError && <div style={{ fontSize: 12, color: '#EF4444', marginTop: 4 }}>{fileError}</div>}
          </div>

          {job.custom_fields?.map((field) => (
            <DynamicField
              key={field.label}
              field={field}
              value={customValues[field.label]}
              onChange={(value) => setCustomValues((v) => ({ ...v, [field.label]: value }))}
            />
          ))}

          {submitError && <div style={{ fontSize: 13, color: '#EF4444' }}>{submitError}</div>}

          <button
            type="submit"
            disabled={submitting}
            style={{
              background: '#0E87FE',
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
              padding: '12px 20px',
              borderRadius: 8,
              border: 'none',
              cursor: submitting ? 'default' : 'pointer',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Submitting…' : 'Submit application'}
          </button>
          <div style={{ fontSize: 11.5, color: '#94A3B8', textAlign: 'center' }}>
            By applying you agree your resume and details will be shared with our hiring team.
          </div>
        </form>
        </div>
      </div>
    </div>
  )
}
