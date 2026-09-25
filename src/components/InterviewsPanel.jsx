import { useEffect, useState } from 'react'
import { assignPanel, createInterview, listInterviewsForApplication, listStagesForJob, updateInterview } from '../lib/interviews'
import { cancelSlot, listSlotsForApplication, proposeSlots } from '../lib/scheduling'
import { logActivity } from '../lib/activityLog'
import { inviteStaff } from '../lib/staff'
import { updateJob } from '../lib/jobs'
import { InlineLoader } from './Spinner'
import InterviewScoring from './InterviewScoring'

const inputStyle = {
  padding: '7px 9px',
  border: '1px solid #E7EBF1',
  borderRadius: 7,
  fontSize: 12.5,
  fontFamily: 'inherit',
}

const labelStyle = { fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#94A3B8' }

const statusColors = {
  scheduled: { bg: '#E9E6F2', color: '#3F3D69' },
  completed: { bg: '#E6F7EC', color: '#16A34A' },
  cancelled: { bg: '#E7EBF1', color: '#475569' },
  no_show: { bg: '#FDEAEA', color: '#EF4444' },
}

// Lets an admin invite a brand-new interviewer without leaving the
// scheduling form — same inviteStaff() edge function Staff Settings
// uses, admin-only server-side too. Freshly-added staff are appended to
// the caller's list and auto-checked onto the panel.
function AddInterviewerInline({ onAdded }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [tempPassword, setTempPassword] = useState(null)

  // A plain div, not a <form> — this renders inside the outer "Schedule
  // interview" form, and nested <form> elements are invalid HTML; the
  // browser collapses them and an inner submit ends up firing the outer
  // form's onSubmit instead. Enter-to-submit is wired manually below.
  async function handleAdd() {
    setSubmitting(true)
    setError(null)
    try {
      const result = await inviteStaff({ name: name.trim(), email: email.trim(), role: 'interviewer' })
      onAdded(result.staff)
      setTempPassword(result.temp_password)
      setName('')
      setEmail('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (name.trim() && email.trim()) handleAdd()
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ background: 'none', border: 'none', color: '#48418A', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', padding: 0 }}
      >
        + Add interviewer
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, border: '1px dashed #E7EBF1', borderRadius: 7, padding: 8 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{ ...inputStyle, flex: '1 1 140px' }}
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{ ...inputStyle, flex: '1 1 180px' }}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={submitting || !name.trim() || !email.trim()}
          style={{ background: '#48418A', color: '#fff', border: 'none', borderRadius: 6, padding: '0 12px', fontSize: 12, fontWeight: 700, cursor: submitting ? 'default' : 'pointer' }}
        >
          {submitting ? 'Adding…' : 'Add'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          Cancel
        </button>
      </div>
      {error && <div style={{ fontSize: 11.5, color: '#EF4444' }}>{error}</div>}
      {tempPassword && (
        <div style={{ fontSize: 11.5, color: '#16A34A' }}>
          Added — temporary password: <strong>{tempPassword}</strong> (share with them; they can change it after signing in)
        </div>
      )}
    </div>
  )
}

// Inline "+ Add criterion" for the job-level scorecard_template array
// (the simpler parallel scorecard system alongside stage criteria/
// interview_scores) — mirrors AddCriterionInline in InterviewScoring.jsx
// but persists via updateJob since this template lives on the job row.
function AddScorecardCriterionInline({ onAdd }) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleAdd() {
    const trimmed = label.trim()
    if (!trimmed) return
    setSubmitting(true)
    setError(null)
    try {
      await onAdd(trimmed)
      setLabel('')
      setOpen(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: '#48418A', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', padding: 0 }}
      >
        + Add criterion
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          autoFocus
          placeholder="Criterion label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAdd()
            }
          }}
          style={{ ...inputStyle, flex: 1, padding: '4px 6px' }}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={submitting}
          style={{ background: '#48418A', color: '#fff', border: 'none', borderRadius: 6, padding: '0 10px', fontSize: 11.5, fontWeight: 700, cursor: submitting ? 'default' : 'pointer' }}
        >
          {submitting ? 'Adding…' : 'Add'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          Cancel
        </button>
      </div>
      {error && <div style={{ fontSize: 11.5, color: '#EF4444' }}>{error}</div>}
    </div>
  )
}

function ScorecardFields({ template, scorecard, editable, onChange, onAddCriterion }) {
  if ((!template || template.length === 0) && !onAddCriterion) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, border: '1px solid #F1F5F9', borderRadius: 7, padding: 8 }}>
      <div style={labelStyle}>Scorecard</div>
      {(template ?? []).map((criterion) => {
        const value = scorecard?.[criterion.label] ?? ''
        if (!editable) {
          return value ? (
            <div key={criterion.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: '#475569' }}>{criterion.label}</span>
              <span style={{ fontWeight: 700 }}>{value}/5</span>
            </div>
          ) : null
        }
        return (
          <label key={criterion.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#475569' }}>{criterion.label}</span>
            <select
              value={value}
              onChange={(e) => onChange({ ...scorecard, [criterion.label]: e.target.value ? Number(e.target.value) : undefined })}
              style={{ ...inputStyle, padding: '4px 6px' }}
            >
              <option value="">—</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )
      })}
      {editable && onAddCriterion && <AddScorecardCriterionInline onAdd={onAddCriterion} />}
    </div>
  )
}

function InterviewCard({ interview, canEditFull, currentUserId, scorecardTemplate, onSave, onCriteriaAdded, onAddScorecardCriterion }) {
  const [status, setStatus] = useState(interview.status)
  const [feedback, setFeedback] = useState(interview.feedback ?? '')
  const [scorecard, setScorecard] = useState(interview.scorecard ?? {})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const isPanelist = interview.panel?.some((p) => p.user?.id === currentUserId)
  const canEditFeedback = canEditFull || isPanelist
  const colors = statusColors[status] ?? statusColors.scheduled
  const panelNames = interview.panel?.map((p) => p.user?.name).filter(Boolean).join(', ')

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
            {interview.stage?.name ? `${interview.stage.name} · ` : ''}
            {interview.scheduled_at ? new Date(interview.scheduled_at).toLocaleString() : 'Not scheduled'}
          </div>
          <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>
            Panel: {panelNames || 'Unassigned'}
            {interview.external_link && (
              <>
                {' · '}
                <a href={interview.external_link} target="_blank" rel="noreferrer" style={{ color: '#48418A' }}>
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
          <ScorecardFields
            template={scorecardTemplate}
            scorecard={scorecard}
            editable
            onChange={(next) => {
              setScorecard(next)
              persist({ scorecard: next })
            }}
            onAddCriterion={canEditFull ? onAddScorecardCriterion : undefined}
          />
        </>
      )}
      {!canEditFeedback && interview.feedback && (
        <div style={{ fontSize: 12.5, color: '#475569', whiteSpace: 'pre-wrap' }}>{interview.feedback}</div>
      )}
      {!canEditFeedback && (
        <ScorecardFields template={scorecardTemplate} scorecard={scorecard} editable={false} />
      )}

      {(isPanelist || canEditFull) && (
        <InterviewScoring
          interview={interview}
          currentUserId={currentUserId}
          isPanelist={isPanelist}
          canEditCriteria={canEditFull}
          onCriteriaAdded={onCriteriaAdded}
        />
      )}

      {saving && <div style={{ fontSize: 11, color: '#94A3B8' }}>Saving&hellip;</div>}
      {error && <div style={{ fontSize: 11.5, color: '#EF4444' }}>{error}</div>}
    </div>
  )
}

function ProposeTimesForm({ applicationId, staffUsers, currentUserId, onDone }) {
  const [interviewerId, setInterviewerId] = useState('')
  const [duration, setDuration] = useState(30)
  const [times, setTimes] = useState([''])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  function updateTime(index, value) {
    setTimes((t) => t.map((v, i) => (i === index ? value : v)))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const isoTimes = times.filter(Boolean).map((t) => new Date(t).toISOString())
    if (isoTimes.length === 0) {
      setError('Add at least one proposed time')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await proposeSlots({ applicationId, interviewerId, createdBy: currentUserId, times: isoTimes, durationMinutes: Number(duration) })
      logActivity({ applicationId, actorId: currentUserId, action: `proposed ${isoTimes.length} interview time${isoTimes.length > 1 ? 's' : ''} to the candidate` })
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8, border: '1px dashed #E7EBF1', borderRadius: 8, padding: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
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
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={labelStyle}>Duration (min)</span>
          <input type="number" min="15" step="15" style={inputStyle} value={duration} onChange={(e) => setDuration(e.target.value)} />
        </label>
      </div>

      <span style={labelStyle}>Proposed times — candidate picks one</span>
      {times.map((t, i) => (
        <input key={i} type="datetime-local" style={inputStyle} value={t} onChange={(e) => updateTime(i, e.target.value)} />
      ))}
      <button
        type="button"
        onClick={() => setTimes((t) => [...t, ''])}
        style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: '#48418A', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}
      >
        + Add another time
      </button>

      {error && <div style={{ fontSize: 12, color: '#EF4444' }}>{error}</div>}

      <button
        type="submit"
        disabled={submitting}
        style={{ alignSelf: 'flex-start', background: '#48418A', color: '#fff', fontWeight: 700, fontSize: 12.5, padding: '7px 14px', borderRadius: 7, border: 'none', cursor: submitting ? 'default' : 'pointer' }}
      >
        {submitting ? 'Sending…' : 'Send times to candidate'}
      </button>
    </form>
  )
}

// Interview scheduling + feedback capture for one application (Section
// 7, items 14/15). Scheduling a new interview is admin/recruiter only;
// the assigned interviewer can record status/feedback on their own
// interview. RLS scopes what each role even sees back from the query.
export default function InterviewsPanel({ applicationId, jobId, staffUsers, currentUser, canSchedule, scorecardTemplate }) {
  const [interviews, setInterviews] = useState(null)
  const [openSlots, setOpenSlots] = useState([])
  const [stages, setStages] = useState([])
  const [localStaffUsers, setLocalStaffUsers] = useState(staffUsers)
  const [localScorecardTemplate, setLocalScorecardTemplate] = useState(scorecardTemplate ?? [])
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [showProposeForm, setShowProposeForm] = useState(false)

  const [scheduledAt, setScheduledAt] = useState('')
  const [mode, setMode] = useState('external')
  const [externalLink, setExternalLink] = useState('')
  const [stageId, setStageId] = useState('')
  const [panelIds, setPanelIds] = useState([])
  const [submitting, setSubmitting] = useState(false)

  async function refresh() {
    try {
      const [ints, slots, jobStages] = await Promise.all([
        listInterviewsForApplication(applicationId),
        canSchedule ? listSlotsForApplication(applicationId) : Promise.resolve([]),
        jobId && canSchedule ? listStagesForJob(jobId) : Promise.resolve([]),
      ])
      setInterviews(ints)
      setOpenSlots(slots.filter((s) => s.status === 'open'))
      setStages(jobStages)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId, jobId])

  useEffect(() => {
    setLocalStaffUsers(staffUsers)
  }, [staffUsers])

  useEffect(() => {
    setLocalScorecardTemplate(scorecardTemplate ?? [])
  }, [scorecardTemplate])

  function handleInterviewerAdded(newStaff) {
    setLocalStaffUsers((list) => [...list, newStaff])
    setPanelIds((ids) => [...ids, newStaff.id])
  }

  // Appends to the job's scorecard_template — persisted on the jobs row,
  // so every interview card for this application shares one updated list.
  async function handleAddScorecardCriterion(label) {
    const next = [...localScorecardTemplate, { label, weight: 1 }]
    const updated = await updateJob(jobId, { scorecard_template: next })
    setLocalScorecardTemplate(updated.scorecard_template)
  }

  function togglePanelist(userId) {
    setPanelIds((ids) => (ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId]))
  }

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
      const interview = await createInterview({
        application_id: applicationId,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        mode,
        external_link: mode === 'external' ? externalLink.trim() || null : null,
        stage_id: stageId || null,
      })
      if (panelIds.length > 0) {
        await assignPanel(interview.id, panelIds)
      }
      logActivity({ applicationId, actorId: currentUser.id, action: 'scheduled an interview' })
      setScheduledAt('')
      setExternalLink('')
      setStageId('')
      setPanelIds([])
      setShowForm(false)
      refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCancelSlot(id) {
    await cancelSlot(id)
    refresh()
  }

  return (
    <div style={{ border: '1px solid #E7EBF1', borderRadius: 12, background: '#fff', boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 6px 16px rgba(15,23,42,0.05)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={labelStyle}>Interviews</div>
        {canSchedule && (
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => setShowProposeForm((s) => !s)}
              style={{ background: 'none', border: 'none', color: '#48418A', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              {showProposeForm ? 'Cancel' : '+ Let candidate pick a time'}
            </button>
            <button
              onClick={() => setShowForm((s) => !s)}
              style={{ background: 'none', border: 'none', color: '#48418A', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              {showForm ? 'Cancel' : '+ Schedule'}
            </button>
          </div>
        )}
      </div>

      {showProposeForm && (
        <ProposeTimesForm
          applicationId={applicationId}
          staffUsers={localStaffUsers}
          currentUserId={currentUser.id}
          onDone={() => {
            setShowProposeForm(false)
            refresh()
          }}
        />
      )}

      {openSlots.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={labelStyle}>Awaiting candidate's pick</span>
          {openSlots.map((slot) => (
            <div key={slot.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, padding: '6px 10px', border: '1px solid #F1F5F9', borderRadius: 7 }}>
              <span>
                {new Date(slot.starts_at).toLocaleString()} ({slot.duration_minutes}m) — {slot.interviewer?.name ?? 'Unassigned'}
              </span>
              <button
                onClick={() => handleCancelSlot(slot.id)}
                style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSchedule} style={{ display: 'flex', flexDirection: 'column', gap: 8, border: '1px dashed #E7EBF1', borderRadius: 8, padding: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={labelStyle}>When</span>
              <input type="datetime-local" style={inputStyle} value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={labelStyle}>Stage</span>
              <select style={inputStyle} value={stageId} onChange={(e) => setStageId(e.target.value)}>
                <option value="">No stage</option>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={labelStyle}>Interview panel</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {localStaffUsers.map((u) => (
                <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: '#475569' }}>
                  <input type="checkbox" checked={panelIds.includes(u.id)} onChange={() => togglePanelist(u.id)} />
                  {u.name}
                </label>
              ))}
            </div>
            {currentUser.role === 'admin' && <AddInterviewerInline onAdded={handleInterviewerAdded} />}
          </div>
          <button
            type="submit"
            disabled={submitting}
            style={{ alignSelf: 'flex-start', background: '#48418A', color: '#fff', fontWeight: 700, fontSize: 12.5, padding: '7px 14px', borderRadius: 7, border: 'none', cursor: submitting ? 'default' : 'pointer' }}
          >
            {submitting ? 'Scheduling…' : 'Schedule interview'}
          </button>
        </form>
      )}

      {error && <div style={{ fontSize: 12.5, color: '#EF4444' }}>{error}</div>}

      {interviews === null && <InlineLoader />}
      {interviews?.length === 0 && <div style={{ fontSize: 12.5, color: '#94A3B8' }}>No interviews scheduled yet.</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {interviews?.map((interview) => (
          <InterviewCard
            key={interview.id}
            interview={interview}
            canEditFull={canSchedule}
            currentUserId={currentUser.id}
            scorecardTemplate={localScorecardTemplate}
            onSave={handleSaveInterview}
            onCriteriaAdded={refresh}
            onAddScorecardCriterion={handleAddScorecardCriterion}
          />
        ))}
      </div>
    </div>
  )
}
