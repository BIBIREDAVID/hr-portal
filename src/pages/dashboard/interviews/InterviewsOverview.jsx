import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listInterviews, updateInterview } from '../../../lib/interviews'
import { useAuth } from '../../../lib/AuthContext'
import { InlineLoader } from '../../../components/Spinner'

const statusColors = {
  scheduled: { bg: '#E9E6F2', color: '#3F3D69' },
  completed: { bg: '#E6F7EC', color: '#16A34A' },
  cancelled: { bg: '#E7EBF1', color: '#475569' },
  no_show: { bg: '#FDEAEA', color: '#EF4444' },
}

const avatarColors = ['#48418A', '#8B5CF6', '#F97316', '#16A34A', '#EF4444', '#3F3D69']

function initials(name) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function avatarColorFor(id) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return avatarColors[hash % avatarColors.length]
}

const inputStyle = {
  padding: '6px 8px',
  border: '1px solid #E2E8F0',
  borderRadius: 6,
  fontSize: 12,
  fontFamily: 'inherit',
  background: '#fff',
}

const cardStyle = {
  border: '1px solid #ECEEF3',
  borderRadius: 12,
  background: '#fff',
  boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 6px 16px rgba(15,23,42,0.05)',
}

// RLS (Phase 1/6) scopes `listInterviews()` per role: admin/recruiter
// see every interview, an interviewer only ever gets their own back —
// so this one page IS the interviewer-scoped view (Section 7, item 16),
// it just doesn't need to know which role it's rendering for to filter
// the list. It only branches role to decide who gets inline edit
// controls on a row.
export default function InterviewsOverview() {
  const { staffUser } = useAuth()
  const canManage = staffUser && ['admin', 'recruiter'].includes(staffUser.role)
  const [interviews, setInterviews] = useState(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState(null)

  async function refresh() {
    try {
      setInterviews(await listInterviews())
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleUpdate(id, patch) {
    try {
      await updateInterview(id, patch)
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  const filteredInterviews = useMemo(() => {
    if (!interviews) return interviews
    const q = search.trim().toLowerCase()
    if (!q) return interviews
    return interviews.filter((i) => i.application.candidate.name.toLowerCase().includes(q))
  }, [interviews, search])

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: '#0F172A' }}>Interviews</h1>
        <p style={{ fontSize: 13, color: '#94A3B8', margin: '2px 0 0' }}>
          {canManage ? 'All scheduled interviews' : 'Interviews assigned to you'}
        </p>
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
          placeholder="Search by candidate…"
          style={{ width: '100%', padding: '9px 12px 9px 34px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, background: '#fff' }}
        />
      </div>

      {error && <div style={{ fontSize: 13, color: '#EF4444' }}>{error}</div>}

      {filteredInterviews === null && <InlineLoader />}
      {filteredInterviews?.length === 0 && (
        <div style={{ fontSize: 13, color: '#94A3B8' }}>
          {interviews.length === 0 ? 'No interviews to show.' : 'No interviews match your search.'}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filteredInterviews?.map((interview) => {
          const canEdit = canManage || interview.interviewer_id === staffUser?.id
          const colors = statusColors[interview.status] ?? statusColors.scheduled
          return (
            <div key={interview.id} style={{ ...cardStyle, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Link
                  to={`/dashboard/candidates/${interview.application.candidate.id}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit' }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 999,
                      background: avatarColorFor(interview.application.candidate.id),
                      color: '#fff',
                      fontSize: 11.5,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flex: '0 0 auto',
                    }}
                  >
                    {initials(interview.application.candidate.name)}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{interview.application.candidate.name}</div>
                    <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
                        <rect x="3" y="5" width="18" height="16" rx="2" />
                        <path d="M3 10h18M8 3v4M16 3v4" />
                      </svg>
                      {interview.application.job.title}
                      {interview.scheduled_at ? ` · ${new Date(interview.scheduled_at).toLocaleString()}` : ' · Not scheduled'}
                      {canManage && interview.interviewer?.name ? ` · Interviewer: ${interview.interviewer.name}` : ''}
                    </div>
                  </div>
                </Link>
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: colors.bg, color: colors.color, flex: '0 0 auto' }}>
                  {interview.status.replace('_', ' ')}
                </span>
              </div>

              {canEdit ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', paddingLeft: 42 }}>
                  <select
                    value={interview.status}
                    onChange={(e) => handleUpdate(interview.id, { status: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="no_show">No show</option>
                  </select>
                  <input
                    defaultValue={interview.feedback ?? ''}
                    placeholder="Feedback"
                    onBlur={(e) => handleUpdate(interview.id, { feedback: e.target.value.trim() || null })}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                </div>
              ) : (
                interview.feedback && <div style={{ fontSize: 12.5, color: '#475569', paddingLeft: 42 }}>{interview.feedback}</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
