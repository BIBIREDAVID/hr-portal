import { Link } from 'react-router-dom'

const FOOTER_HEIGHT = 64

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
            background: 'linear-gradient(135deg, #48418A, #3F3D69)',
          }}
        />
        <div style={{ fontWeight: 800, fontSize: 15.5 }}>HR Portal</div>
        <div style={{ fontSize: 12.5, color: '#94A3B8', fontWeight: 600, marginLeft: 2 }}>Careers</div>
      </Link>
      <Link to="/status" style={{ fontSize: 13, fontWeight: 700, color: '#3F3D69', textDecoration: 'none' }}>
        Check application status
      </Link>
    </div>
  )
}

export function PublicFooter() {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: FOOTER_HEIGHT,
        borderTop: '1px solid #ECEEF3',
        background: '#fff',
        padding: '0 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 10,
        zIndex: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: 6,
            background: 'linear-gradient(135deg, #48418A, #2E2C4D)',
          }}
        />
        <span style={{ fontSize: 12.5, color: '#94A3B8' }}>
          &copy; {new Date().getFullYear()} HR Portal. All rights reserved.
        </span>
      </div>
      <div style={{ display: 'flex', gap: 18 }}>
        <Link to="/apply" style={{ fontSize: 12.5, color: '#64748B', textDecoration: 'none' }}>
          Careers
        </Link>
        <Link to="/status" style={{ fontSize: 12.5, color: '#64748B', textDecoration: 'none' }}>
          Application status
        </Link>
        <Link to="/privacy" style={{ fontSize: 12.5, color: '#64748B', textDecoration: 'none' }}>
          Privacy
        </Link>
      </div>
    </div>
  )
}

export function PublicShell({ children, maxWidth = 720, background = '#F6F8FB' }) {
  return (
    <div style={{ minHeight: '100vh', width: '100%', background: '#fff', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>
      <PublicHeader />
      <div style={{ flex: 1, width: '100%', background, display: 'flex', justifyContent: 'center', paddingBottom: FOOTER_HEIGHT }}>
        <div style={{ width: '100%', maxWidth, padding: '48px 24px 72px' }}>{children}</div>
      </div>
      <PublicFooter />
    </div>
  )
}
