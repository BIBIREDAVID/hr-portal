import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listApplicationsByIds, listStaffUsers } from '../../../lib/applications'

const stageLabels = {
  new: 'New',
  screening: 'Screening',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Rejected',
}

// Side-by-side scorecards for finalists (Section 6/9, item 22). Reads
// application ids from ?ids=a,b,c so the comparison set can be shared
// via URL or opened straight from a bookmark.
export default function ComparePage() {
  const [searchParams] = useSearchParams()
  const ids = (searchParams.get('ids') ?? '').split(',').filter(Boolean)
  const [applications, setApplications] = useState(null)
  const [staffUsers, setStaffUsers] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    if (ids.length === 0) return
    Promise.all([listApplicationsByIds(ids), listStaffUsers()])
      .then(([apps, staff]) => {
        // preserve the order the ids were selected in
        setApplications(ids.map((id) => apps.find((a) => a.id === id)).filter(Boolean))
        setStaffUsers(staff)
      })
      .catch((err) => setError(err.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('ids')])

  if (ids.length === 0) {
    return (
      <div style={{ padding: 32, fontSize: 13, color: '#94A3B8' }}>
        Select two or more applications from the{' '}
        <Link to="/dashboard/applications" style={{ color: '#0E87FE' }}>
          Applications
        </Link>{' '}
        table to compare them.
      </div>
    )
  }

  if (error) {
    return <div style={{ padding: 32, fontSize: 13, color: '#EF4444' }}>{error}</div>
  }

  if (!applications) {
    return <div style={{ padding: 32 }}>Loading&hellip;</div>
  }

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Compare candidates</h1>
        <p style={{ fontSize: 13, color: '#94A3B8', margin: '2px 0 0' }}>{applications.length} finalists</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${applications.length}, minmax(220px, 1fr))`, gap: 14, overflowX: 'auto' }}>
        {applications.map((app) => (
          <div key={app.id} style={{ border: '1px solid #E7EBF1', borderRadius: 12, background: '#fff', boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 6px 16px rgba(15,23,42,0.05)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <Link to={`/dashboard/candidates/${app.candidate.id}`} style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', textDecoration: 'none' }}>
                {app.candidate.name}
              </Link>
              <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{app.job.title}</div>
            </div>

            <div>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#94A3B8' }}>Stage</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{stageLabels[app.stage]}</div>
            </div>

            <div>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#94A3B8' }}>Score</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0E87FE' }}>{app.score ?? '—'}</div>
                {app.score != null && (
                  <div style={{ flex: 1, height: 6, background: '#F1F5F9', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(app.score, 10) * 10}%`, height: '100%', background: '#0E87FE' }} />
                  </div>
                )}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#94A3B8' }}>Rating</div>
              <div style={{ fontSize: 14, color: '#F97316', marginTop: 4 }}>{app.rating ? '★'.repeat(app.rating) : '—'}</div>
            </div>

            {app.score_notes && (
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#94A3B8' }}>Score notes</div>
                <div style={{ fontSize: 12.5, color: '#475569', marginTop: 4, whiteSpace: 'pre-wrap' }}>{app.score_notes}</div>
              </div>
            )}

            <div>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#94A3B8' }}>Assigned to</div>
              <div style={{ fontSize: 12.5, color: '#475569', marginTop: 4 }}>
                {staffUsers.find((u) => u.id === app.assigned_to)?.name ?? 'Unassigned'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#94A3B8' }}>Tags</div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
                {app.tags?.length > 0 ? (
                  app.tags.map((tag) => (
                    <span key={tag} style={{ fontSize: 11, fontWeight: 600, background: '#E7F2FF', color: '#0A6BCB', padding: '3px 8px', borderRadius: 999 }}>
                      {tag}
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: 12.5, color: '#94A3B8' }}>—</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
