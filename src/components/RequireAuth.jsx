import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { PageLoader } from './Spinner'

export default function RequireAuth({ children }) {
  const { session, staffUser, loading, error, signOut } = useAuth()
  const location = useLocation()

  if (loading) {
    return <PageLoader />
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Signed in to Supabase Auth but with no staff profile (not invited,
  // or the profile lookup failed) — never render the dashboard shell
  // with a null staffUser.
  if (!staffUser) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: 420, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>No access</div>
          <div style={{ fontSize: 13.5, color: '#475569' }}>
            {error?.message || "Your login isn't linked to a staff account. Ask an admin to invite you."}
          </div>
          <button
            type="button"
            onClick={signOut}
            style={{ alignSelf: 'center', background: '#48418A', color: '#fff', fontWeight: 700, fontSize: 13, padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer' }}
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  return children
}
