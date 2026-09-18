import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getApplicationStatus } from '../../lib/apply'
import { listChatMessagesAsCandidate, sendChatMessageAsCandidate } from '../../lib/chat'
import { bookSlotAsCandidate, listOpenSlotsAsCandidate } from '../../lib/scheduling'
import ChatThread from '../../components/ChatThread'
import { PublicShell } from '../../components/PublicShell'

function InterviewSlotPicker({ statusToken, applicationId }) {
  const [slots, setSlots] = useState(null)
  const [booked, setBooked] = useState(null)
  const [booking, setBooking] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    listOpenSlotsAsCandidate({ statusToken, applicationId })
      .then(setSlots)
      .catch((err) => setError(err.message))
  }, [statusToken, applicationId])

  async function handleBook(slotId) {
    setBooking(slotId)
    setError(null)
    try {
      const interview = await bookSlotAsCandidate({ statusToken, applicationId, slotId })
      setBooked(interview)
    } catch (err) {
      setError(err.message)
    } finally {
      setBooking(null)
    }
  }

  if (booked) {
    return (
      <div style={{ fontSize: 12.5, color: '#166534', background: '#E6F7EC', border: '1px solid #BBF7D0', borderRadius: 8, padding: 10 }}>
        You're booked for {new Date(booked.scheduled_at).toLocaleString()}. Watch your email for details.
      </div>
    )
  }

  if (!slots || slots.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, border: '1px solid #E7EBF1', borderRadius: 10, padding: 12, background: '#F9FAFC' }}>
      <div style={{ fontSize: 12.5, fontWeight: 700 }}>🗓️ Pick an interview time</div>
      {error && <div style={{ fontSize: 12, color: '#EF4444' }}>{error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {slots.map((slot) => (
          <button
            key={slot.id}
            onClick={() => handleBook(slot.id)}
            disabled={booking === slot.id}
            style={{
              textAlign: 'left',
              background: '#fff',
              border: '1px solid #E1E6EF',
              borderRadius: 8,
              padding: '9px 12px',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: booking ? 'default' : 'pointer',
              opacity: booking && booking !== slot.id ? 0.6 : 1,
            }}
          >
            {new Date(slot.starts_at).toLocaleString()} ({slot.duration_minutes} min)
            {slot.interviewer?.name ? ` — with ${slot.interviewer.name}` : ''}
            {booking === slot.id ? ' — booking…' : ''}
          </button>
        ))}
      </div>
    </div>
  )
}

const stageLabels = {
  new: 'New',
  screening: 'Screening',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Not moving forward',
}

const stageColors = {
  new: { bg: '#E7EBF1', color: '#475569' },
  screening: { bg: '#F1EBFF', color: '#8B5CF6' },
  shortlisted: { bg: '#E7F2FF', color: '#0A6BCB' },
  interview: { bg: '#FFEEE2', color: '#F97316' },
  offer: { bg: '#FFEEE2', color: '#F97316' },
  hired: { bg: '#E6F7EC', color: '#16A34A' },
  rejected: { bg: '#FDEAEA', color: '#EF4444' },
}

export default function StatusPage() {
  const { token } = useParams()
  const [applications, setApplications] = useState(null)
  const [error, setError] = useState(null)
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    getApplicationStatus(token)
      .then(setApplications)
      .catch(() => setError('We couldn\'t find that application.'))
  }, [token])

  return (
    <PublicShell maxWidth={620}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#0A6BCB' }}>
            Application status
          </div>
          {applications && applications.length > 0 && (
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: '8px 0 0' }}>Hi {applications[0].candidate_name} 👋</h1>
          )}
        </div>

        {error && (
          <div style={{ fontSize: 13, color: '#EF4444', background: '#FDEAEA', border: '1px solid #FBD5D5', borderRadius: 10, padding: 16 }}>
            {error}
          </div>
        )}

        {!error && !applications && <div style={{ fontSize: 13, color: '#94A3B8' }}>Loading&hellip;</div>}

        {applications && applications.length === 0 && (
          <div style={{ fontSize: 13, color: '#94A3B8' }}>We couldn't find that application.</div>
        )}

        {applications && applications.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {applications.map((app) => {
              const colors = stageColors[app.stage] ?? stageColors.new
              const isExpanded = expandedId === app.application_id
              return (
                <div
                  key={app.application_id}
                  style={{
                    background: '#fff',
                    border: '1px solid #E7EBF1',
                    borderRadius: 14,
                    padding: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14,
                    boxShadow: '0 1px 2px rgba(15,23,42,0.03), 0 8px 20px rgba(15,23,42,0.04)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{app.job_title}</div>
                      <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 3 }}>{app.department}</div>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '5px 12px',
                        borderRadius: 999,
                        background: colors.bg,
                        color: colors.color,
                        flex: '0 0 auto',
                      }}
                    >
                      {stageLabels[app.stage] ?? app.stage}
                    </span>
                  </div>

                  <InterviewSlotPicker statusToken={token} applicationId={app.application_id} />

                  <button
                    onClick={() => setExpandedId(isExpanded ? null : app.application_id)}
                    style={{
                      alignSelf: 'flex-start',
                      background: isExpanded ? '#E7F2FF' : 'none',
                      border: isExpanded ? 'none' : '1px solid #E7EBF1',
                      color: '#0A6BCB',
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: '7px 14px',
                      borderRadius: 8,
                    }}
                  >
                    {isExpanded ? 'Hide messages' : '💬 Message HR about this application'}
                  </button>

                  {isExpanded && (
                    <ChatThread
                      viewerType="candidate"
                      title="Messages"
                      fetchMessages={() => listChatMessagesAsCandidate({ statusToken: token, applicationId: app.application_id })}
                      sendMessage={(body) => sendChatMessageAsCandidate({ statusToken: token, applicationId: app.application_id, body })}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </PublicShell>
  )
}
