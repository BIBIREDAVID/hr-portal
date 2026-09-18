import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listApplications, listStaffUsers, STAGES, updateApplication } from '../../../lib/applications'
import { listJobs } from '../../../lib/jobs'
import { createSavedFilter, deleteSavedFilter, listSavedFilters } from '../../../lib/savedFilters'
import { maybeSendStageChangeEmail, sendTemplatedEmail } from '../../../lib/emailSending'
import { logActivity } from '../../../lib/activityLog'
import { setCandidateNavList } from '../../../lib/candidateNav'
import { computeMatchScore } from '../../../lib/matchScore'
import KanbanBoard from '../../../components/KanbanBoard'
import RejectEmailModal from '../../../components/RejectEmailModal'
import { useAuth } from '../../../lib/AuthContext'

const stageLabels = {
  new: 'New',
  screening: 'Screening',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Rejected',
}

const filterInputStyle = {
  padding: '7px 10px',
  border: '1px solid #E2E8F0',
  borderRadius: 7,
  fontSize: 12.5,
  background: '#fff',
}

const stageColors = {
  new: { bg: '#E7EBF1', color: '#475569' },
  screening: { bg: '#F1EBFF', color: '#8B5CF6' },
  shortlisted: { bg: '#E9E6F2', color: '#3F3D69' },
  interview: { bg: '#FFEEE2', color: '#F97316' },
  offer: { bg: '#FFEEE2', color: '#F97316' },
  hired: { bg: '#E6F7EC', color: '#16A34A' },
  rejected: { bg: '#FDEAEA', color: '#EF4444' },
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

export default function ApplicationsList() {
  const { staffUser } = useAuth()
  const canManage = staffUser && ['admin', 'recruiter'].includes(staffUser.role)
  const [view, setView] = useState('kanban')
  const [applications, setApplications] = useState(null)
  const [jobs, setJobs] = useState([])
  const [staffUsers, setStaffUsers] = useState([])
  const [error, setError] = useState(null)

  const [filters, setFilters] = useState({ jobId: '', stage: '', assignedTo: '', tag: '', minScore: '', minRating: '' })
  const [savedFilters, setSavedFilters] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [bulkStage, setBulkStage] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [sortByMatch, setSortByMatch] = useState(false)
  const [nameSearch, setNameSearch] = useState('')

  useEffect(() => {
    listJobs().then(setJobs).catch(() => {})
    listStaffUsers().then(setStaffUsers).catch(() => {})
  }, [])

  useEffect(() => {
    if (staffUser) listSavedFilters(staffUser.id).then(setSavedFilters).catch(() => {})
  }, [staffUser])

  async function refresh() {
    try {
      const apps = await listApplications(filters)
      setApplications(apps)
      setSelected(new Set())
      // dedupe, preserving first-seen order — backs CandidateNav's prev/next
      setCandidateNavList([...new Set(apps.map((a) => a.candidate.id))])
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

  async function handleStageChange(applicationId, stage) {
    try {
      await updateApplication(applicationId, { stage })
      maybeSendStageChangeEmail([applicationId], stage)
      logActivity({ applicationId, actorId: staffUser.id, action: `moved this application to ${stageLabels[stage]}` })
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  function toggleSelected(id) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelected((s) => (s.size === applications.length ? new Set() : new Set(applications.map((a) => a.id))))
  }

  async function handleBulkStageChange() {
    if (!bulkStage || selected.size === 0) return
    setBulkBusy(true)
    setError(null)
    try {
      const ids = [...selected]
      await Promise.all(ids.map((id) => updateApplication(id, { stage: bulkStage })))
      maybeSendStageChangeEmail(ids, bulkStage)
      ids.forEach((id) => logActivity({ applicationId: id, actorId: staffUser.id, action: `moved this application to ${stageLabels[bulkStage]} (bulk action)` }))
      setBulkStage('')
      refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBulkBusy(false)
    }
  }

  async function handleBulkReject({ subject, body }) {
    const ids = [...selected]
    // The stage change is the part that must not silently fail or be
    // left ambiguous — always apply it, close the modal, and refresh
    // even if the email send below fails. Email is best-effort, same as
    // maybeSendStageChangeEmail elsewhere; the difference here is the
    // user explicitly asked to send one, so a failure is surfaced as a
    // page-level warning rather than swallowed.
    await Promise.all(ids.map((id) => updateApplication(id, { stage: 'rejected' })))
    ids.forEach((id) => logActivity({ applicationId: id, actorId: staffUser.id, action: 'rejected this application (bulk action)' }))
    setShowRejectModal(false)
    refresh()

    try {
      await sendTemplatedEmail({ applicationIds: ids, type: 'rejection', subject, body })
    } catch (err) {
      setError(`Applications were rejected, but the email failed to send: ${err.message}`)
    }
  }

  function setFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value }))
  }

  async function handleSaveFilter() {
    const name = window.prompt('Name this filter preset:')
    if (!name?.trim()) return
    try {
      const saved = await createSavedFilter({ userId: staffUser.id, name: name.trim(), filterConfig: filters })
      setSavedFilters((list) => [...list, saved])
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDeleteFilter(id) {
    try {
      await deleteSavedFilter(id)
      setSavedFilters((list) => list.filter((f) => f.id !== id))
    } catch (err) {
      setError(err.message)
    }
  }

  // Keyword match score — a simple, no-AI ATS-style ranking signal for
  // comparing multiple applicants to the same job (matches parsed
  // resume text against the job's requirements/description). It's
  // informational only: manual score/rating stay the source of truth.
  const applicationsWithMatch = useMemo(() => {
    if (!applications) return applications
    return applications.map((app) => ({
      ...app,
      matchScore: computeMatchScore(app.job, app.candidate.resume_parsed?.text),
    }))
  }, [applications])

  const displayedApplications = useMemo(() => {
    if (!applicationsWithMatch) return applicationsWithMatch
    const q = nameSearch.trim().toLowerCase()
    let list = q ? applicationsWithMatch.filter((a) => a.candidate.name.toLowerCase().includes(q)) : applicationsWithMatch
    if (sortByMatch) {
      // Unscoreable applications (no resume text, or job has no
      // requirements to match against) sort last rather than first.
      list = [...list].sort((a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1))
    }
    return list
  }, [applicationsWithMatch, sortByMatch, nameSearch])

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Applications</h1>
          <p style={{ fontSize: 13, color: '#94A3B8', margin: '2px 0 0' }}>
            {applications ? `${applications.length} application${applications.length === 1 ? '' : 's'}` : 'Loading…'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {canManage && (
            <Link
              to="/dashboard/candidates/new"
              style={{
                background: '#48418A',
                color: '#fff',
                fontWeight: 700,
                fontSize: 12.5,
                padding: '8px 14px',
                borderRadius: 7,
                textDecoration: 'none',
                alignSelf: 'center',
              }}
            >
              + Add candidate
            </Link>
          )}
          <button
            onClick={() => setView('table')}
            style={{
              background: view === 'table' ? '#48418A' : '#fff',
              color: view === 'table' ? '#fff' : '#475569',
              border: '1px solid #E7EBF1',
              borderRadius: 7,
              padding: '7px 14px',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Table
          </button>
          <button
            onClick={() => setView('kanban')}
            style={{
              background: view === 'kanban' ? '#48418A' : '#fff',
              color: view === 'kanban' ? '#fff' : '#475569',
              border: '1px solid #E7EBF1',
              borderRadius: 7,
              padding: '7px 14px',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Kanban
          </button>
        </div>
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
          value={nameSearch}
          onChange={(e) => setNameSearch(e.target.value)}
          placeholder="Search candidates…"
          style={{ width: '100%', padding: '9px 12px 9px 34px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, background: '#fff' }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select style={filterInputStyle} value={filters.jobId} onChange={(e) => setFilter('jobId', e.target.value)}>
          <option value="">All jobs</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title}
            </option>
          ))}
        </select>
        <select style={filterInputStyle} value={filters.stage} onChange={(e) => setFilter('stage', e.target.value)}>
          <option value="">All stages</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {stageLabels[s]}
            </option>
          ))}
        </select>
        <select style={filterInputStyle} value={filters.assignedTo} onChange={(e) => setFilter('assignedTo', e.target.value)}>
          <option value="">Anyone assigned</option>
          <option value="unassigned">Unassigned</option>
          {staffUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <input
          style={filterInputStyle}
          placeholder="Filter by tag"
          value={filters.tag}
          onChange={(e) => setFilter('tag', e.target.value)}
        />
        <input
          type="number"
          min="0"
          max="10"
          step="0.1"
          style={{ ...filterInputStyle, width: 90 }}
          placeholder="Min score"
          value={filters.minScore}
          onChange={(e) => setFilter('minScore', e.target.value)}
        />
        <select style={filterInputStyle} value={filters.minRating} onChange={(e) => setFilter('minRating', e.target.value)}>
          <option value="">Any rating</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {'★'.repeat(n)}+
            </option>
          ))}
        </select>
        <button
          onClick={handleSaveFilter}
          style={{ ...filterInputStyle, background: '#fff', fontWeight: 600, color: '#475569', cursor: 'pointer' }}
        >
          + Save filter
        </button>
      </div>

      {savedFilters.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {savedFilters.map((sf) => (
            <span
              key={sf.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11.5,
                fontWeight: 600,
                color: '#475569',
                background: '#F1F5F9',
                border: '1px solid #E7EBF1',
                borderRadius: 999,
                padding: '4px 6px 4px 12px',
              }}
            >
              <button
                onClick={() => setFilters(sf.filter_config)}
                style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer' }}
              >
                {sf.name}
              </button>
              <button
                onClick={() => handleDeleteFilter(sf.id)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: 12, padding: '2px 4px', lineHeight: 1 }}
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}

      {error && <div style={{ fontSize: 13, color: '#EF4444' }}>{error}</div>}

      {applications && applications.length === 0 && (
        <div style={{ fontSize: 13, color: '#94A3B8' }}>No applications match these filters.</div>
      )}

      {applications && applications.length > 0 && view === 'kanban' && (
        <KanbanBoard applications={displayedApplications} onStageChange={handleStageChange} />
      )}

      {applications && applications.length > 0 && view === 'table' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setSortByMatch((v) => !v)}
              title="Rank by keyword match against the job's requirements — a simple, no-AI signal for comparing multiple applicants, not a replacement for manual scoring"
              style={{
                background: sortByMatch ? '#48418A' : '#fff',
                color: sortByMatch ? '#fff' : '#475569',
                border: '1px solid #E7EBF1',
                borderRadius: 7,
                padding: '7px 14px',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Sort by match {sortByMatch ? '✓' : ''}
            </button>
          </div>

          {canManage && selected.size > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#EFEDF6', border: '1px solid #E9E6F2', borderRadius: 10, padding: '10px 16px' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#3F3D69' }}>{selected.size} selected</div>
              <select
                value={bulkStage}
                onChange={(e) => setBulkStage(e.target.value)}
                style={filterInputStyle}
              >
                <option value="">Move to stage…</option>
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {stageLabels[s]}
                  </option>
                ))}
              </select>
              <button
                onClick={handleBulkStageChange}
                disabled={!bulkStage || bulkBusy}
                style={{ ...filterInputStyle, background: '#48418A', color: '#fff', fontWeight: 700, border: 'none', cursor: bulkStage ? 'pointer' : 'default' }}
              >
                Apply
              </button>
              <button
                onClick={() => setShowRejectModal(true)}
                disabled={bulkBusy}
                style={{ ...filterInputStyle, background: '#fff', color: '#EF4444', fontWeight: 700, border: '1px solid #FDEAEA', cursor: 'pointer' }}
              >
                Reject with email…
              </button>
              {selected.size >= 2 && (
                <Link
                  to={`/dashboard/applications/compare?ids=${[...selected].join(',')}`}
                  style={{ ...filterInputStyle, background: '#fff', color: '#475569', fontWeight: 700, textDecoration: 'none' }}
                >
                  Compare
                </Link>
              )}
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: canManage ? 'auto 2fr 1.4fr 1fr 0.6fr 0.8fr 0.8fr 1.2fr 1.2fr' : '2fr 1.4fr 1fr 0.6fr 0.8fr 0.8fr 1.2fr 1.2fr',
              padding: '0 16px',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#94A3B8',
              alignItems: 'center',
            }}
          >
            {canManage && (
              <input type="checkbox" checked={selected.size === applications.length} onChange={toggleSelectAll} />
            )}
            <div>Candidate</div>
            <div>Job</div>
            <div>Stage</div>
            <div>Score</div>
            <div>Rating</div>
            <div>Match</div>
            <div>Assigned to</div>
            <div>Tags</div>
          </div>
          {displayedApplications.map((app) => (
            <div
              key={app.id}
              style={{
                display: 'grid',
                gridTemplateColumns: canManage ? 'auto 2fr 1.4fr 1fr 0.6fr 0.8fr 0.8fr 1.2fr 1.2fr' : '2fr 1.4fr 1fr 0.6fr 0.8fr 0.8fr 1.2fr 1.2fr',
                alignItems: 'center',
                padding: '12px 16px',
                border: '1px solid #E7EBF1',
                borderRadius: 12,
                background: '#fff',
                boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.05)',
              }}
            >
              {canManage && (
                <input type="checkbox" checked={selected.has(app.id)} onChange={() => toggleSelected(app.id)} />
              )}
              <Link
                to={`/dashboard/candidates/${app.candidate.id}`}
                style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit', minWidth: 0 }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 999,
                    background: avatarColorFor(app.candidate.id),
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: '0 0 auto',
                  }}
                >
                  {initials(app.candidate.name)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.candidate.name}</div>
                  <div style={{ fontSize: 11.5, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.candidate.email}</div>
                </div>
              </Link>
              <div style={{ fontSize: 13, color: '#475569' }}>{app.job.title}</div>
              <div>
                <span
                  style={{
                    display: 'inline-flex',
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 9px',
                    borderRadius: 999,
                    background: stageColors[app.stage]?.bg,
                    color: stageColors[app.stage]?.color,
                  }}
                >
                  {stageLabels[app.stage]}
                </span>
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>{app.score ?? '—'}</div>
              <div style={{ fontSize: 12, color: '#F97316' }}>{app.rating ? '★'.repeat(app.rating) : '—'}</div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: app.matchScore == null ? '#94A3B8' : '#48418A' }}>
                {app.matchScore == null ? '—' : `${app.matchScore}%`}
              </div>
              <div style={{ fontSize: 12.5, color: '#475569' }}>
                {staffUsers.find((u) => u.id === app.assigned_to)?.name ?? '—'}
              </div>
              <div style={{ fontSize: 11.5, color: '#94A3B8' }}>{app.tags?.join(', ') || '—'}</div>
            </div>
          ))}
        </div>
      )}

      {showRejectModal && (
        <RejectEmailModal count={selected.size} onConfirm={handleBulkReject} onClose={() => setShowRejectModal(false)} />
      )}
    </div>
  )
}
