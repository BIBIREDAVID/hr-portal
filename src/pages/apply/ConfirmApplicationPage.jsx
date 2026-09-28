import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { confirmApplication } from '../../lib/apply'
import { PublicShell } from '../../components/PublicShell'
import { PageLoader } from '../../components/Spinner'

// Landing page for the "Confirm my application" link emailed to
// returning candidates. Confirms, then sends them to their status page.
export default function ConfirmApplicationPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    confirmApplication(token)
      .then((result) => {
        if (active) navigate(`/status/${result.status_token}`, { replace: true })
      })
      .catch((err) => {
        if (active) setError(err.message)
      })
    return () => {
      active = false
    }
  }, [token, navigate])

  if (!error) {
    return (
      <PublicShell>
        <PageLoader />
      </PublicShell>
    )
  }

  return (
    <PublicShell maxWidth={560}>
      <div
        style={{
          background: '#fff',
          border: '1px solid #E7EBF1',
          borderRadius: 16,
          padding: 40,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <h1 style={{ fontSize: 18, margin: 0 }}>We couldn't confirm your application</h1>
        <p style={{ fontSize: 13.5, color: '#475569', margin: 0 }}>{error}</p>
        <Link to="/apply" style={{ fontSize: 14, color: '#48418A', fontWeight: 700, textDecoration: 'none' }}>
          ← View all open positions
        </Link>
      </div>
    </PublicShell>
  )
}
