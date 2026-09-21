import { useAuth } from '../lib/AuthContext'
import { PageLoader } from './Spinner'

// Gate for UI restricted to specific staff roles (e.g. Section 7 Phase 2:
// "Job CRUD UI (admin/recruiter only)"). Renders inline rather than
// redirecting, since this only ever sits inside routes already behind
// RequireAuth — the visitor is signed in, just not permitted here.
export default function RequireRole({ roles, children }) {
  const { staffUser, loading } = useAuth()

  if (loading || !staffUser) {
    return <PageLoader />
  }

  if (!roles.includes(staffUser.role)) {
    return (
      <div style={{ padding: 32 }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>Not authorized</h2>
        <p style={{ fontSize: 13, color: '#64748B', marginTop: 8 }}>
          Your role ({staffUser.role}) doesn't have access to this page.
        </p>
      </div>
    )
  }

  return children
}
