import { useAuth } from '../../lib/AuthContext'
import TodoWidget from '../../components/TodoWidget'

export default function DashboardHome() {
  const { staffUser } = useAuth()

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
          Welcome{staffUser ? `, ${staffUser.name}` : ''}
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B' }}>
          {staffUser
            ? `Signed in as ${staffUser.email} (${staffUser.role})`
            : 'Setting up your account…'}
        </p>
      </div>

      {staffUser && (
        <div style={{ maxWidth: 480 }}>
          <TodoWidget userId={staffUser.id} />
        </div>
      )}
    </div>
  )
}
