import { useState } from 'react'
import { REJECTION_TEMPLATE } from '../lib/emailSending'

const inputStyle = {
  padding: '9px 11px',
  border: '1px solid #E7EBF1',
  borderRadius: 8,
  fontSize: 13,
  fontFamily: 'inherit',
  width: '100%',
}

// Bulk-reject flow (Section 6/7): moves the selected applications to
// `rejected` and sends each candidate a templated email, reviewed/edited
// here before sending. {{candidate_name}} / {{job_title}} are filled in
// per-recipient by the Edge Function.
export default function RejectEmailModal({ count, onConfirm, onClose }) {
  const [subject, setSubject] = useState(REJECTION_TEMPLATE.subject)
  const [body, setBody] = useState(REJECTION_TEMPLATE.body)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  async function handleSend() {
    setError(null)
    setSending(true)
    try {
      await onConfirm({ subject, body })
    } catch (err) {
      setError(err.message)
      setSending(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 520, background: '#fff', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Reject {count} application{count === 1 ? '' : 's'}</h2>
          <p style={{ fontSize: 12.5, color: '#94A3B8', margin: '4px 0 0' }}>
            This moves the selected applications to "Rejected" and sends this email to each candidate. Use
            {' '}<code>{'{{candidate_name}}'}</code> and <code>{'{{job_title}}'}</code> — they're filled in per recipient.
          </p>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Subject</span>
          <input style={inputStyle} value={subject} onChange={(e) => setSubject(e.target.value)} />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Message</span>
          <textarea rows={8} style={{ ...inputStyle, resize: 'vertical' }} value={body} onChange={(e) => setBody(e.target.value)} />
        </label>

        {error && <div style={{ fontSize: 12.5, color: '#EF4444' }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={sending}
            style={{ background: '#fff', border: '1px solid #E7EBF1', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            style={{
              background: '#EF4444',
              color: '#fff',
              fontWeight: 700,
              fontSize: 13,
              padding: '9px 18px',
              borderRadius: 8,
              border: 'none',
              cursor: sending ? 'default' : 'pointer',
              opacity: sending ? 0.7 : 1,
            }}
          >
            {sending ? 'Sending…' : 'Reject & send email'}
          </button>
        </div>
      </div>
    </div>
  )
}

