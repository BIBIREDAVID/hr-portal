import { lazy, Suspense, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getCandidate } from '../../../lib/candidates'
import { listApplicationsForCandidate, listStaffUsers, updateApplication } from '../../../lib/applications'
import { createNotification } from '../../../lib/notifications'
import { maybeSendStageChangeEmail } from '../../../lib/emailSending'
import { logActivity } from '../../../lib/activityLog'
import { listChatMessages, markChatReadByHr, sendChatMessageAsStaff } from '../../../lib/chat'
import { computeMatchDetails } from '../../../lib/matchScore'
import { useAuth } from '../../../lib/AuthContext'
import ResumeViewer from '../../../components/ResumeViewer'
import ScoringPanel from '../../../components/ScoringPanel'
import NotesThread from '../../../components/NotesThread'
import InterviewsPanel from '../../../components/InterviewsPanel'
import ActivityLogPanel from '../../../components/ActivityLogPanel'
import CvAnalysisPanel from '../../../components/CvAnalysisPanel'
import ChatThread from '../../../components/ChatThread'
import CandidateNav from '../../../components/CandidateNav'
import { PageLoader } from '../../../components/Spinner'

// @react-pdf/renderer is sizeable — only load it when someone actually
// opens the offer letter modal, not on every candidate page visit.
const OfferLetterModal = lazy(() => import('../../../components/OfferLetterModal'))

const stageLabels = {
  new: 'New',
  screening: 'Screening',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Rejected',
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

const PROGRESS_STAGES = ['new', 'screening', 'shortlisted', 'interview', 'offer', 'hired']
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

// Small numbered progress dots like the reference's candidate profile
// view — filled up to the current stage. `rejected` is a dropout, not a
// step on this ladder, so it renders as a plain red pill instead.
function StageProgress({ stage }) {
  if (stage === 'rejected') {
    return (
      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: '#FDEAEA', color: '#EF4444' }}>
        Rejected
      </span>
    )
  }
  const currentIndex = PROGRESS_STAGES.indexOf(stage)
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {PROGRESS_STAGES.map((s, i) => (
        <div
          key={s}
          title={stageLabels[s]}
          style={{
            width: 20,
            height: 20,
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: i <= currentIndex ? '#48418A' : '#E7EBF1',
            color: i <= currentIndex ? '#fff' : '#94A3B8',
          }}
        >
          {i + 1}
        </div>
      ))}
    </div>
  )
}

export default function CandidateDetail() {
  const { id } = useParams()
  const { staffUser } = useAuth()
  const canManage = staffUser && ['admin', 'recruiter'].includes(staffUser.role)
  const [candidate, setCandidate] = useState(null)
  const [applications, setApplications] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [staffUsers, setStaffUsers] = useState([])
  const [error, setError] = useState(null)
  const [showOfferLetter, setShowOfferLetter] = useState(false)

  async function load() {
    try {
      const [c, apps, staff] = await Promise.all([
        getCandidate(id),
        listApplicationsForCandidate(id),
        listStaffUsers(),
      ])
      setCandidate(c)
      setApplications(apps)
      setStaffUsers(staff)
      setSelectedId((current) => current ?? apps[0]?.id ?? null)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const selectedApplication = applications?.find((a) => a.id === selectedId)

  function handleAnalyzed(updatedApplication) {
    setApplications((apps) => apps.map((a) => (a.id === updatedApplication.id ? { ...a, ...updatedApplication } : a)))
  }

  async function handleSave(patch) {
    const previous = selectedApplication
    await updateApplication(selectedId, patch)

    if (
      patch.assigned_to &&
      patch.assigned_to !== previous.assigned_to &&
      patch.assigned_to !== staffUser?.id
    ) {
      await createNotification({
        userId: patch.assigned_to,
        type: 'assignment',
        referenceId: selectedId,
        message: `${staffUser?.name ?? 'Someone'} assigned you to ${candidate.name}'s application for ${previous.job.title}`,
      })
      const assignee = staffUsers.find((u) => u.id === patch.assigned_to)
      logActivity({ applicationId: selectedId, actorId: staffUser.id, action: `assigned this application to ${assignee?.name ?? 'someone'}` })
    }

    if (patch.stage && patch.stage !== previous.stage) {
      maybeSendStageChangeEmail([selectedId], patch.stage)
      logActivity({ applicationId: selectedId, actorId: staffUser.id, action: `moved this application to ${stageLabels[patch.stage]}` })
    }

    if ('score' in patch) {
      logActivity({ applicationId: selectedId, actorId: staffUser.id, action: `set the score to ${patch.score ?? '(cleared)'}` })
    }

    if ('rating' in patch) {
      logActivity({ applicationId: selectedId, actorId: staffUser.id, action: patch.rating ? `set the rating to ${patch.rating} star${patch.rating === 1 ? '' : 's'}` : 'cleared the rating' })
    }

    if (patch.tags) {
      logActivity({ applicationId: selectedId, actorId: staffUser.id, action: `updated tags to: ${patch.tags.join(', ') || '(none)'}` })
    }

    await load()
  }

  if (error) {
    return <div style={{ padding: 32, fontSize: 13, color: '#EF4444' }}>{error}</div>
  }

  if (!candidate || !applications) {
    return <PageLoader />
  }

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <CandidateNav currentId={candidate.id} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: 14 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 999,
              background: avatarColorFor(candidate.id),
              color: '#fff',
              fontSize: 16,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: '0 0 auto',
            }}
          >
            {initials(candidate.name)}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: '#0F172A' }}>{candidate.name}</h1>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', background: '#E7EBF1', padding: '3px 9px', borderRadius: 999 }}>
                {candidate.source === 'hr_upload' ? 'HR upload' : 'Public application'}
              </span>
              {selectedApplication && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 9px',
                    borderRadius: 999,
                    background: stageColors[selectedApplication.stage]?.bg,
                    color: stageColors[selectedApplication.stage]?.color,
                  }}
                >
                  {stageLabels[selectedApplication.stage]}
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 4 }}>
              {candidate.email}
              {candidate.phone ? ` · ${candidate.phone}` : ''}
              {candidate.portfolio_url ? (
                <>
                  {' · '}
                  <a href={candidate.portfolio_url} target="_blank" rel="noreferrer" style={{ color: '#48418A' }}>
                    Portfolio
                  </a>
                </>
              ) : null}
            </div>
            {selectedApplication && (
              <div style={{ marginTop: 10 }}>
                <StageProgress stage={selectedApplication.stage} />
              </div>
            )}
          </div>
        </div>
        {canManage && selectedApplication && (
          <button
            onClick={() => setShowOfferLetter(true)}
            style={{
              background: '#fff',
              border: '1px solid #E2E8F0',
              borderRadius: 8,
              padding: '9px 16px',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
            }}
          >
            Generate offer letter
          </button>
        )}
      </div>

      {applications.length > 1 && (
        <div style={{ display: 'flex', gap: 8 }}>
          {applications.map((app) => (
            <button
              key={app.id}
              onClick={() => setSelectedId(app.id)}
              style={{
                background: app.id === selectedId ? '#48418A' : '#fff',
                color: app.id === selectedId ? '#fff' : '#475569',
                border: '1px solid #E7EBF1',
                borderRadius: 999,
                padding: '6px 14px',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {app.job.title} &middot; {stageLabels[app.stage]}
            </button>
          ))}
        </div>
      )}

      {applications.length === 0 && (
        <div style={{ fontSize: 13, color: '#94A3B8' }}>This candidate has no applications yet.</div>
      )}

      {selectedApplication && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <ResumeViewer resumePath={candidate.resume_url} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {(() => {
              const details = computeMatchDetails(selectedApplication.job, candidate.resume_parsed?.text)
              if (!details) return null
              return (
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: 8, background: '#E9E6F2', borderRadius: 10, padding: '10px 12px' }}
                  title="Weighted keyword/phrase match against this job's requirements — no AI, informational only"
                >
                  <div style={{ fontSize: 12, color: '#48418A' }}>
                    CV match: <strong>{details.score}%</strong>
                  </div>
                  {details.seniority && (
                    <div style={{ fontSize: 11.5, color: details.seniority.meetsRequirement ? '#166534' : '#B45309' }}>
                      {details.seniority.meetsRequirement ? '✓' : '⚠'} Wants {details.seniority.requiredYears}+ yrs — resume mentions{' '}
                      {details.seniority.resumeYears != null ? `${details.seniority.resumeYears} yrs` : 'none found'}
                    </div>
                  )}
                  {details.matchedRequiredKeywords.length > 0 && (
                    <div style={{ fontSize: 11.5, color: '#3F3D69' }}>
                      Matched requirements: {details.matchedRequiredKeywords.slice(0, 8).join(', ')}
                    </div>
                  )}
                  {details.missingRequiredKeywords.length > 0 && (
                    <div style={{ fontSize: 11.5, color: '#B45309' }}>
                      Missing requirements: {details.missingRequiredKeywords.slice(0, 8).join(', ')}
                    </div>
                  )}
                </div>
              )
            })()}
            {canManage ? (
              <ScoringPanel key={`scoring-${selectedApplication.id}`} application={selectedApplication} staffUsers={staffUsers} onSave={handleSave} />
            ) : (
              <div style={{ border: '1px solid #E7EBF1', borderRadius: 12, background: '#fff', boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 6px 16px rgba(15,23,42,0.05)', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#94A3B8' }}>
                  Pipeline status
                </div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{stageLabels[selectedApplication.stage]}</div>
                {selectedApplication.score != null && (
                  <div style={{ fontSize: 12.5, color: '#475569' }}>Score: {selectedApplication.score}</div>
                )}
                {selectedApplication.tags?.length > 0 && (
                  <div style={{ fontSize: 12.5, color: '#475569' }}>Tags: {selectedApplication.tags.join(', ')}</div>
                )}
                <div style={{ fontSize: 11.5, color: '#94A3B8' }}>Only HR (admin/recruiter) can edit scoring and stage.</div>
              </div>
            )}

            {canManage && (
              <CvAnalysisPanel application={selectedApplication} onAnalyzed={handleAnalyzed} />
            )}

            {staffUser && (
              <InterviewsPanel
                applicationId={selectedApplication.id}
                jobId={selectedApplication.job.id}
                staffUsers={staffUsers}
                currentUser={staffUser}
                canSchedule={canManage}
                scorecardTemplate={selectedApplication.job.scorecard_template}
              />
            )}

            {canManage && staffUser && (
              <NotesThread
                key={`notes-${selectedApplication.id}`}
                applicationId={selectedApplication.id}
                currentUser={staffUser}
                staffUsers={staffUsers}
                candidateName={candidate.name}
                jobTitle={selectedApplication.job.title}
              />
            )}

            {canManage && staffUser && (
              <ChatThread
                key={`chat-${selectedApplication.id}`}
                viewerType="hr"
                title="Chat with candidate"
                fetchMessages={async () => {
                  const messages = await listChatMessages(selectedApplication.id)
                  markChatReadByHr(selectedApplication.id)
                  return messages
                }}
                sendMessage={(body) =>
                  sendChatMessageAsStaff({ applicationId: selectedApplication.id, senderUserId: staffUser.id, body })
                }
              />
            )}

            {canManage && <ActivityLogPanel key={`activity-${selectedApplication.id}`} applicationId={selectedApplication.id} />}
          </div>
        </div>
      )}

      {showOfferLetter && selectedApplication && (
        <Suspense fallback={null}>
          <OfferLetterModal
            candidate={candidate}
            application={selectedApplication}
            actorId={staffUser?.id}
            onClose={() => setShowOfferLetter(false)}
          />
        </Suspense>
      )}
    </div>
  )
}
