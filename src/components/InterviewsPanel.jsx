import { useEffect, useState } from 'react'
import { createInterview, listInterviewsForApplication, updateInterview } from '../lib/interviews'
import { logActivity } from '../lib/activityLog'

const inputStyle = {
  padding: '7px 9px',
  border: '1px solid #E7EBF1',
  borderRadius: 7,
  fontSize: 12.5,
  fontFamily: 'inherit',
}

const labelStyle = { fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#94A3B8' }

const statusColors = {
  scheduled: { bg: '#E7F2FF', color: '#0A6BCB' },
  completed: { bg: '#E6F7EC', color: '#16A34A' },
  cancelled: { bg: '#E7EBF1', color: '#475569' },
  no_show: { bg: '#FDEAEA', color: '#EF4444' },
}

function toDateTimeLocal(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function InterviewCard({ interview, canEditFull, currentUserId, onSave }) {
  const [status, setStatus] = useState(interview.status)
  const [feedback, setFeedback] = useState(interview.feedback ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const canEditFeedback = canEditFull || interview.interviewer_id === currentUserId
  const colors = statusColors[status] ?? statusColors.scheduled

  async function persist(patch) {
    setError(null)
    setSaving(true)
    try {
      await onSave(interview.id, patch)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ border: '1px solid #E7EBF1', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            {interview.scheduled_at ? new Date(interview.scheduled_at).toLocaleString() : 'Not scheduled'}
          </div>
          <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>
            Interviewer: {interview.interviewer?.name ?? 'Unassigned'}
            {interview.external_link && (
              <>
                {' · '}
                <a href={interview.external_link} target="_blank" rel="noreferrer" style={{ color: '#0E87FE' }}>
                  Join link
                </a>
              </>
            )}
          </div>
        </div>
        <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: colors.bg, color: colors.color }}>
          {status.replace('_', ' ')}
        </span>
      </div>

      {canEditFeedback && (
        <>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              persist({ status: e.target.value })
            }}
            style={{ ...inputStyle, alignSelf: 'flex-start' }}
          >
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No show</option>
          </select>
          <textarea
            rows={3}
            placeholder="Feedback"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            onBlur={() => persist({ feedback: feedback.trim() || null })}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </>
      )}
      {!canEditFeedback && interview.feedback && (
        <div style={{ fontSize: 12.5, color: '#475569', whiteSpace: 'pre-wrap' }}>{interview.feedback}</div>
      )}

      {saving && <div style={{ fontSize: 11, color: '#94A3B8' }}>Saving&hellip;</div>}
      {error && <div style={{ fontSize: 11.5, color: '#EF4444' }}>{error}</div>}
    </div>
  )
}

// Interview scheduling + feedback capture for one application (Section
// 7, items 14/15). Scheduling a new interview is admin/recruiter only;
// the assigned interviewer can record status/feedback on their own
// interview. RLS scopes what each role even sees back from the query.
export default function InterviewsPanel({ applicationId, staffUsers, currentUser, canSchedule }) {
  const [interviews, setInterviews] = useState(null)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)

  const [scheduledAt, setScheduledAt] = useState('')
  const [mode, setMode] = useState('external')
  const [externalLink, setExternalLink] = useState('')
  const [interviewerId, setInterviewerId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function refresh() {
    try {
      setInterviews(await listInterviewsForApplication(applicationId))
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId])

  async function handleSaveInterview(id, patch) {
    await updateInterview(id, patch)
    if (patch.status) {
      logActivity({ applicationId, actorId: currentUser.id, action: `marked an interview as ${patch.status.replace('_', ' ')}` })
    }
    refresh()
  }

  async function handleSchedule(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await createInterview({
        application_id: applicationId,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        mode,
        external_link: mode === 'external' ? externalLink.trim() || null : null,
        interviewer_id: interviewerId || null,
      })
      logActivity({ applicationId, actorId: currentUser.id, action: 'scheduled an interview' })
      setScheduledAt('')
      setExternalLink('')
      setInterviewerId('')
      setShowForm(false)
      refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ border: '1px solid #E7EBF1', borderRadius: 12, background: '#fff', boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 6px 16px rgba(15,23,42,0.05)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={labelStyle}>Interviews</div>
        {canSchedule && (
          <button
            onClick={() => setShowForm((s) => !s)}
            style={{ background: 'none', border: 'none', color: '#0E87FE', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            {showForm ? 'Cancel' : '+ Schedule'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSchedule} style={{ display: 'flex', flexDirection: 'column', gap: 8, border: '1px dashed #E7EBF1', borderRadius: 8, padding: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={labelStyle}>When</span>
              <input type="datetime-local" style={inputStyle} value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={labelStyle}>Interviewer</span>
              <select style={inputStyle} value={interviewerId} onChange={(e) => setInterviewerId(e.target.value)}>
                <option value="">Unassigned</option>
                {staffUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={labelStyle}>Mode</span>
              <select style={inputStyle} value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="external">External (Zoom/Meet/etc.)</option>
                <option value="in_portal">In-portal (reserved)</option>
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={labelStyle}>Link</span>
              <input
                type="url"
                disabled={mode !== 'external'}
                style={inputStyle}
                placeholder="https://…"
                value={externalLink}
                onChange={(e) => setExternalLink(e.target.value)}
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={submitting}
            style={{ alignSelf: 'flex-start', background: '#0E87FE', color: '#fff', fontWeight: 700, fontSize: 12.5, padding: '7px 14px', borderRadius: 7, border: 'none', cursor: submitting ? 'default' : 'pointer' }}
          >
            {submitting ? 'Scheduling…' : 'Schedule interview'}
          </button>
        </form>
      )}

      {error && <div style={{ fontSize: 12.5, color: '#EF4444' }}>{error}</div>}

      {interviews === null && <div style={{ fontSize: 12.5, color: '#94A3B8' }}>Loading&hellip;</div>}
      {interviews?.length === 0 && <div style={{ fontSize: 12.5, color: '#94A3B8' }}>No interviews scheduled yet.</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {interviews?.map((interview) => (
          <InterviewCard
            key={interview.id}
            interview={interview}
            canEditFull={canSchedule}
            currentUserId={currentUser.id}
            onSave={handleSaveInterview}
          />
        ))}
      </div>
    </div>
  )
}
