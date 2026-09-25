import { useState } from 'react'
import { Link } from 'react-router-dom'
import { requestStatusLinkByEmail } from '../../lib/apply'
import { PublicShell } from '../../components/PublicShell'

// Reached at /status with no token. A candidate's status link is emailed
// to them when they apply, but people lose emails — this page now lets
// them ask for it again by email address (handled by the
// resend-status-link Edge Function) instead of being a dead end.
export default function StatusLookupPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setResult(null)
    try {
      const data = await requestStatusLinkByEmail(email.trim())
      setResult(data.message)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PublicShell maxWidth={520}>
      <div
        style={{
          background: '#fff',
          border: '1px solid #E7EBF1',
          borderRadius: 16,
          boxShadow: '0 1px 2px rgba(15,23,42,0.03), 0 8px 24px rgba(15,23,42,0.04)',
          padding: '44px 40px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: '#E9E6F2',
            color: '#3F3D69',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 18px',
            fontSize: 22,
          }}
        >
          ✉
        </div>
        <h1 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 10px' }}>Check your application status</h1>
        <p style={{ fontSize: 13.5, color: '#64748B', margin: '0 0 22px', lineHeight: 1.6 }}>
          We emailed you a personal status link when you applied — look for "We received your
          application" in your inbox. Lost it? Enter the email you applied with and we'll send it
          again.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left', marginBottom: 22 }}>
          <label style={{ fontSize: 12.5, fontWeight: 700, color: '#334155' }}>Email address</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{
              padding: '10px 12px',
              border: '1px solid #E2E8F0',
              borderRadius: 9,
              fontSize: 13.5,
              fontFamily: 'inherit',
            }}
          />
          <button
            type="submit"
            disabled={submitting}
            style={{
              marginTop: 4,
              background: 'linear-gradient(135deg, #48418A, #3F3D69)',
              color: '#fff',
              border: 'none',
              borderRadius: 9,
              padding: '11px 18px',
              fontSize: 13.5,
              fontWeight: 700,
              cursor: submitting ? 'default' : 'pointer',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Sending…' : 'Email me my status link'}
          </button>
        </form>

        {result && (
          <div style={{ fontSize: 13, color: '#166534', background: '#E6F7EC', border: '1px solid #BBF7D0', borderRadius: 10, padding: 14, marginBottom: 18, textAlign: 'left' }}>
            {result}
          </div>
        )}
        {error && (
          <div style={{ fontSize: 13, color: '#EF4444', background: '#FDEAEA', border: '1px solid #FBD5D5', borderRadius: 10, padding: 14, marginBottom: 18, textAlign: 'left' }}>
            {error}
          </div>
        )}

        <Link
          to="/apply"
          style={{
            display: 'inline-block',
            fontSize: 13.5,
            fontWeight: 700,
            color: '#fff',
            textDecoration: 'none',
            background: 'linear-gradient(135deg, #48418A, #3F3D69)',
            padding: '10px 20px',
            borderRadius: 9,
          }}
        >
          ← View open positions
        </Link>
      </div>
    </PublicShell>
  )
}
