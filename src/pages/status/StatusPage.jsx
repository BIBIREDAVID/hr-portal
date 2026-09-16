import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getApplicationStatus } from '../../lib/apply'
import { listChatMessagesAsCandidate, sendChatMessageAsCandidate } from '../../lib/chat'
import ChatThread from '../../components/ChatThread'

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
    <div
      style={{
        minHeight: '100vh',
        background: '#F6F8FB',
        fontFamily: 'system-ui, sans-serif',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '64px 24px',
      }}
    >
      <div
        style={{
          width: 480,
          background: '#fff',
          border: '1px solid #ECEEF3',
          borderRadius: 16,
          boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.06)',
          padding: '40px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 800 }}>Application status</div>

        {error && <div style={{ fontSize: 13, color: '#EF4444' }}>{error}</div>}

        {!error && !applications && <div style={{ fontSize: 13, color: '#94A3B8' }}>Loading&hellip;</div>}

        {applications && applications.length === 0 && (
          <div style={{ fontSize: 13, color: '#94A3B8' }}>We couldn't find that application.</div>
        )}

        {applications && applications.length > 0 && (
          <>
            <div style={{ fontSize: 13, color: '#94A3B8' }}>Hi {applications[0].candidate_name}, here's where things stand:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {applications.map((app) => {
                const colors = stageColors[app.stage] ?? stageColors.new
                const isExpanded = expandedId === app.application_id
                return (
                  <div key={app.application_id} style={{ border: '1px solid #E7EBF1', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{app.job_title}</div>
                        <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{app.department}</div>
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: 999,
                          background: colors.bg,
                          color: colors.color,
                        }}
                      >
                        {stageLabels[app.stage] ?? app.stage}
                      </span>
                    </div>

                    <button
                      onClick={() => setExpandedId(isExpanded ? null : app.application_id)}
                      style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: '#0E87FE', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}
                    >
                      {isExpanded ? 'Hide messages' : 'Message HR about this application'}
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
          </>
        )}
      </div>
    </div>
  )
}
