import { Link } from 'react-router-dom'
import { PublicShell } from '../../components/PublicShell'

// Reached at /status with no token. Unlike /status/:token (a real,
// emailed link), there's no way to look up an application from here —
// the token is the only credential a candidate has, so this just points
// them back to where they'd find it instead of rendering nothing.
export default function StatusLookupPage() {
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
          application" in your inbox and open the link there. This page can't look up an
          application without it.
        </p>
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
