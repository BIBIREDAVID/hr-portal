import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getOpenJobs } from '../../lib/apply'
import { PublicShell } from '../../components/PublicShell'

const workModeLabels = { onsite: 'On-site', remote: 'Remote', hybrid: 'Hybrid' }

const workModeColors = {
  onsite: { bg: '#FFEEE2', color: '#F97316' },
  remote: { bg: '#E6F7EC', color: '#16A34A' },
  hybrid: { bg: '#E9E6F2', color: '#3F3D69' },
}

function initials(title) {
  return title
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function JobsBoard() {
  const [jobs, setJobs] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getOpenJobs()
      .then(setJobs)
      .catch(() => setError('We couldn\'t load open positions right now. Please try again shortly.'))
  }, [])

  return (
    <PublicShell maxWidth={760}>
      <div
        style={{
          background: 'linear-gradient(135deg, #48418A, #2E2C4D)',
          borderRadius: 20,
          padding: '44px 40px',
          marginBottom: 32,
          color: '#fff',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.75 }}>
          We're hiring
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 800, margin: '10px 0 8px' }}>Come build with us</h1>
        <p style={{ fontSize: 14.5, opacity: 0.9, margin: 0, maxWidth: 480, lineHeight: 1.6 }}>
          Browse our current openings below and apply directly — no account or sign-up required.
        </p>
      </div>

      {error && (
        <div style={{ fontSize: 13, color: '#EF4444', background: '#FDEAEA', border: '1px solid #FBD5D5', borderRadius: 10, padding: 14 }}>
          {error}
        </div>
      )}

      {!error && !jobs && <div style={{ fontSize: 13, color: '#94A3B8' }}>Loading&hellip;</div>}

      {jobs && jobs.length === 0 && (
        <div style={{ fontSize: 13.5, color: '#94A3B8', textAlign: 'center', padding: '40px 0' }}>
          There are no open positions right now. Please check back soon.
        </div>
      )}

      {jobs && jobs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {jobs.map((job) => {
            const modeColor = workModeColors[job.work_mode] ?? workModeColors.onsite
            return (
              <Link
                key={job.id}
                to={`/apply/${job.slug || job.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  background: '#fff',
                  border: '1px solid #E7EBF1',
                  borderRadius: 14,
                  padding: '20px 22px',
                  textDecoration: 'none',
                  color: 'inherit',
                  boxShadow: '0 1px 2px rgba(15,23,42,0.03), 0 6px 16px rgba(15,23,42,0.04)',
                  transition: 'transform 0.12s ease, box-shadow 0.12s ease',
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: '#E9E6F2',
                    color: '#3F3D69',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 800,
                    flex: '0 0 auto',
                  }}
                >
                  {initials(job.title)}
                </div>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{job.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
                    {job.department && <span style={{ fontSize: 12.5, color: '#94A3B8' }}>{job.department}</span>}
                    {job.locations?.length > 0 && <span style={{ fontSize: 12.5, color: '#94A3B8' }}>· {job.locations.join(', ')}</span>}
                    {job.work_mode && (
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: modeColor.color,
                          background: modeColor.bg,
                          padding: '2px 8px',
                          borderRadius: 999,
                        }}
                      >
                        {workModeLabels[job.work_mode]}
                      </span>
                    )}
                  </div>
                  {job.headline && <div style={{ fontSize: 13, color: '#475569', marginTop: 8 }}>{job.headline}</div>}
                </div>

                <span style={{ fontSize: 13, fontWeight: 700, color: '#48418A', flex: '0 0 auto' }}>Apply →</span>
              </Link>
            )
          })}
        </div>
      )}
    </PublicShell>
  )
}
