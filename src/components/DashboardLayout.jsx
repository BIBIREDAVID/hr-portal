import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import NotificationsBell from './NotificationsBell'

function Icon({ path }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {path}
    </svg>
  )
}

const navItems = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    end: true,
    icon: (
      <>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </>
    ),
  },
  {
    to: '/dashboard/jobs',
    label: 'Jobs',
    icon: (
      <>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </>
    ),
  },
  {
    to: '/dashboard/applications',
    label: 'Applications',
    icon: (
      <>
        <path d="M4 5h6v14H4z" />
        <path d="M14 5h6v9h-6z" />
      </>
    ),
  },
  {
    to: '/dashboard/interviews',
    label: 'Interviews',
    icon: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </>
    ),
  },
  {
    to: '/dashboard/calendar',
    label: 'Calendar',
    icon: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
        <path d="M8 15h2M14 15h2" />
      </>
    ),
  },
  {
    to: '/dashboard/reports',
    label: 'Reports',
    icon: <path d="M4 20V10M12 20V4M20 20v-7" />,
  },
]

const SETTINGS_ICON = (
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 0 1-4 0v-.09a1.7 1.7 0 0 0-1-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 0 1 0-4h.09a1.7 1.7 0 0 0 1.56-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.55V3a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 0 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1z" />
  </>
)

const STAFF_ICON = (
  <>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </>
)

const SECTION_LABELS = {
  jobs: 'Jobs',
  applications: 'Applications',
  candidates: 'Candidates',
  interviews: 'Interviews',
  calendar: 'Calendar',
  reports: 'Reports',
  settings: 'Settings',
}

const linkStyle = ({ isActive }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '9px 12px',
  borderRadius: 8,
  fontSize: 13.5,
  fontWeight: 600,
  textDecoration: 'none',
  color: isActive ? '#0A6BCB' : '#475569',
  background: isActive ? '#E7F2FF' : 'transparent',
})

export default function DashboardLayout() {
  const { staffUser, signOut } = useAuth()
  const canManage = staffUser && ['admin', 'recruiter'].includes(staffUser.role)
  const location = useLocation()

  const segment = location.pathname.split('/')[2]
  const sectionLabel = SECTION_LABELS[segment] ?? 'Overview'
  const initial = staffUser?.name?.[0]?.toUpperCase() ?? '?'

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif', background: '#F6F8FB' }}>
      <div
        style={{
          width: 232,
          flex: '0 0 auto',
          height: '100vh',
          overflowY: 'auto',
          borderRight: '1px solid #ECEEF3',
          background: '#fff',
          padding: '22px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 6px' }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, background: '#0E87FE' }} />
          <div style={{ fontWeight: 800, fontSize: 14.5 }}>HR Portal</div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} style={linkStyle}>
              <Icon path={item.icon} />
              {item.label}
            </NavLink>
          ))}
          {canManage && (
            <NavLink to="/dashboard/settings/email-triggers" style={linkStyle}>
              <Icon path={SETTINGS_ICON} />
              Settings
            </NavLink>
          )}
          {staffUser?.role === 'admin' && (
            <NavLink to="/dashboard/settings/staff" style={linkStyle}>
              <Icon path={STAFF_ICON} />
              Staff
            </NavLink>
          )}
        </nav>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 6px' }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                background: '#0E87FE',
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: '0 0 auto',
              }}
            >
              {initial}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {staffUser?.name}
              </div>
              <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'capitalize' }}>{staffUser?.role}</div>
            </div>
          </div>
          <button
            onClick={signOut}
            style={{
              background: '#fff',
              border: '1px solid #ECEEF3',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0, height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            flex: '0 0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 28px',
            borderBottom: '1px solid #ECEEF3',
            background: '#fff',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#0B4A8F',
            }}
          >
            / {sectionLabel}
          </div>
          <NotificationsBell />
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 4px 0' }}>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
