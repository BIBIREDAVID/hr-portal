import { Link } from 'react-router-dom'

// Shared chrome for the public-facing pages (careers board, apply form,
// status lookup) — keeps them visually part of one "careers site"
// instead of each looking like a bare, unstyled form.
export function PublicHeader() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '18px 32px',
        borderBottom: '1px solid #ECEEF3',
        background: '#fff',
      }}
    >
      <Link to="/apply" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', color: 'inherit' }}>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #0E87FE, #0A6BCB)',
          }}
        />
        <div style={{ fontWeight: 800, fontSize: 15.5 }}>HR Portal</div>
        <div style={{ fontSize: 12.5, color: '#94A3B8', fontWeight: 600, marginLeft: 2 }}>Careers</div>
      </Link>
      <Link to="/status" style={{ fontSize: 13, fontWeight: 700, color: '#0A6BCB', textDecoration: 'none' }}>
        Check application status
      </Link>
    </div>
  )
}

export function PublicShell({ children, maxWidth = 720, background = '#F6F8FB' }) {
  return (
    <div style={{ minHeight: '100vh', width: '100%', background: '#fff', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>
      <PublicHeader />
      <div style={{ flex: 1, width: '100%', background, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth, padding: '48px 24px 72px' }}>{children}</div>
      </div>
    </div>
  )
}
