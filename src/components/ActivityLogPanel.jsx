import { useEffect, useState } from 'react'
import { listActivityForApplication } from '../lib/activityLog'
import { InlineLoader } from './Spinner'

function timeAgo(isoString) {
  const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

// Read-only audit trail for one application (Section 6/7, item 24).
export default function ActivityLogPanel({ applicationId }) {
  const [entries, setEntries] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    listActivityForApplication(applicationId)
      .then(setEntries)
      .catch((err) => setError(err.message))
  }, [applicationId])

  return (
    <div style={{ border: '1px solid #E7EBF1', borderRadius: 12, background: '#fff', boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 6px 16px rgba(15,23,42,0.05)', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#94A3B8' }}>
        Activity
      </div>

      {error && <div style={{ fontSize: 12.5, color: '#EF4444' }}>{error}</div>}
      {entries === null && !error && <InlineLoader />}
      {entries?.length === 0 && <div style={{ fontSize: 12.5, color: '#94A3B8' }}>No activity yet.</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
        {entries?.map((entry) => (
          <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5 }}>
            <span style={{ color: '#334155' }}>
              <strong>{entry.actor?.name ?? 'System'}</strong> {entry.action}
            </span>
            <span style={{ color: '#94A3B8', flex: '0 0 auto' }}>{timeAgo(entry.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
