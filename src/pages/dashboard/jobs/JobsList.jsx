import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteJob, getApplicantCountsByJob, listJobs } from '../../../lib/jobs'

const statusStyles = {
  draft: { bg: '#E7EBF1', color: '#475569', dot: '#94A3B8' },
  open: { bg: '#E6F7EC', color: '#16A34A', dot: '#16A34A' },
  closed: { bg: '#FDEAEA', color: '#EF4444', dot: '#EF4444' },
}

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString()
}

const cardStyle = {
  border: '1px solid #ECEEF3',
  borderRadius: 12,
  background: '#fff',
  boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.05)',
}

export default function JobsList() {
  const [jobs, setJobs] = useState(null)
  const [applicantCounts, setApplicantCounts] = useState({})
  const [search, setSearch] = useState('')
  const [error, setError] = useState(null)
  const [copiedId, setCopiedId] = useState(null)

  async function refresh() {
    try {
      const [jobsData, counts] = await Promise.all([listJobs(), getApplicantCountsByJob()])
      setJobs(jobsData)
      setApplicantCounts(counts)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleCopyLink(job) {
    const url = `${window.location.origin}/apply/${job.id}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(job.id)
      setTimeout(() => setCopiedId((id) => (id === job.id ? null : id)), 1500)
    } catch (err) {
      setError('Could not copy link: ' + err.message)
    }
  }

  async function handleDelete(job) {
    if (!confirm(`Delete "${job.title}"? This cannot be undone.`)) return
    try {
      await deleteJob(job.id)
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  const filteredJobs = useMemo(() => {
    if (!jobs) return jobs
    const q = search.trim().toLowerCase()
    if (!q) return jobs
    return jobs.filter((j) => j.title.toLowerCase().includes(q) || j.department?.toLowerCase().includes(q))
  }, [jobs, search])

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: '#0F172A' }}>Jobs</h1>
          <p style={{ fontSize: 13, color: '#94A3B8', margin: '2px 0 0' }}>
            {jobs ? `${jobs.length} posting${jobs.length === 1 ? '' : 's'}` : 'Loading…'}
          </p>
        </div>
        <Link
          to="/dashboard/jobs/new"
          style={{
            background: '#48418A',
            color: '#fff',
            fontWeight: 700,
            fontSize: 13,
            padding: '10px 18px',
            borderRadius: 8,
            textDecoration: 'none',
            boxShadow: '0 1px 2px rgba(14,135,254,0.15), 0 4px 10px rgba(14,135,254,0.2)',
          }}
        >
          + New job
        </Link>
      </div>

      <div style={{ position: 'relative', maxWidth: 320 }}>
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#94A3B8"
          strokeWidth="2"
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search jobs…"
          style={{
            width: '100%',
            padding: '9px 12px 9px 34px',
            border: '1px solid #E2E8F0',
            borderRadius: 8,
            fontSize: 13,
            background: '#fff',
          }}
        />
      </div>

      {error && <div style={{ fontSize: 13, color: '#EF4444' }}>{error}</div>}

      {filteredJobs && filteredJobs.length === 0 && (
        <div style={{ fontSize: 13, color: '#94A3B8' }}>
          {jobs.length === 0 ? 'No jobs yet — create your first posting.' : 'No jobs match your search.'}
        </div>
      )}

      {filteredJobs && filteredJobs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2.4fr 1fr 1fr 1fr 1fr auto',
              padding: '0 18px',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#94A3B8',
            }}
          >
            <div>Title</div>
            <div>Department</div>
            <div>Status</div>
            <div>Applicants</div>
            <div>Expires</div>
            <div></div>
          </div>

          {filteredJobs.map((job) => {
            const status = statusStyles[job.status] ?? statusStyles.draft
            return (
              <div
                key={job.id}
                style={{
                  ...cardStyle,
                  display: 'grid',
                  gridTemplateColumns: '2.4fr 1fr 1fr 1fr 1fr auto',
                  alignItems: 'center',
                  padding: '14px 18px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 9,
                      background: '#E9E6F2',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flex: '0 0 auto',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3F3D69" strokeWidth="2">
                      <rect x="3" y="7" width="18" height="13" rx="2" />
                      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{job.title}</div>
                    <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
                      {job.custom_fields?.length ?? 0} custom field
                      {job.custom_fields?.length === 1 ? '' : 's'}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: '#475569' }}>{job.department || '—'}</div>
                <div>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '4px 10px 4px 8px',
                      borderRadius: 999,
                      background: status.bg,
                      color: status.color,
                      textTransform: 'capitalize',
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: status.dot }} />
                    {job.status}
                  </span>
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A' }}>{applicantCounts[job.id] ?? 0}</div>
                <div style={{ fontSize: 13, color: '#94A3B8' }}>{formatDate(job.expires_at)}</div>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <button
                    onClick={() => handleCopyLink(job)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: copiedId === job.id ? '#16A34A' : '#48418A',
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {copiedId === job.id ? 'Copied!' : 'Copy link'}
                  </button>
                  <Link to={`/dashboard/jobs/${job.id}`} style={{ fontSize: 12.5, fontWeight: 600, color: '#48418A', textDecoration: 'none' }}>
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(job)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#EF4444',
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
