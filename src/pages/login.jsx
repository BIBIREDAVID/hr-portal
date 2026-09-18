import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

const inputStyle = {
  padding: '11px 13px',
  border: '1px solid #E2E8F0',
  borderRadius: 8,
  fontSize: 14,
  fontFamily: 'inherit',
}

const stagePills = [
  { label: 'Screening', bg: 'rgba(255,255,255,0.16)' },
  { label: 'Interview', bg: 'rgba(255,255,255,0.16)' },
  { label: 'Offer', bg: 'rgba(255,255,255,0.16)' },
  { label: 'Hired', bg: 'rgba(255,255,255,0.24)' },
]

export default function Login() {
  const { session, signInWithPassword } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  if (session) {
    const from = location.state?.from?.pathname || '/dashboard'
    return <Navigate to={from} replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error: signInError } = await signInWithPassword(email, password)
    setSubmitting(false)
    if (signInError) setError(signInError.message)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: 'system-ui, sans-serif' }}>
      <div
        style={{
          flex: '1 1 50%',
          background: 'linear-gradient(160deg, #48418A 0%, #2E2C4D 100%)',
          color: '#fff',
          padding: '56px 64px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, background: '#fff' }} />
          <div style={{ fontWeight: 800, fontSize: 16 }}>HR Portal</div>
        </div>

        <div style={{ maxWidth: 420 }}>
          <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.25 }}>
            Run your whole hiring pipeline in one place.
          </div>
          <p style={{ fontSize: 14, opacity: 0.85, marginTop: 14, lineHeight: 1.6 }}>
            Jobs, applications, interviews, and reporting — everything your team needs to move candidates
            from applied to hired.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 28, flexWrap: 'wrap' }}>
            {stagePills.map((s) => (
              <span
                key={s.label}
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '6px 14px',
                  borderRadius: 999,
                  background: s.bg,
                }}
              >
                {s.label}
              </span>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 12, opacity: 0.7 }}>&copy; {new Date().getFullYear()} HR Interview Portal</div>
      </div>

      <div style={{ flex: '1 1 50%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#fff' }}>
        <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: '#0F172A' }}>Sign in</h1>
            <p style={{ fontSize: 13, color: '#94A3B8', margin: '4px 0 0' }}>Sign in with your HR account</p>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Password</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
          </label>

          {error && <div style={{ fontSize: 12.5, color: '#EF4444' }}>{error}</div>}

          <button
            type="submit"
            disabled={submitting}
            style={{
              background: '#48418A',
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
              padding: '12px 16px',
              borderRadius: 8,
              border: 'none',
              cursor: submitting ? 'default' : 'pointer',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
