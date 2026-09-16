import { useAuth } from '../../../lib/AuthContext'
import CalendarView from '../../../components/CalendarView'
import TodoWidget from '../../../components/TodoWidget'

export default function CalendarPage() {
  const { staffUser } = useAuth()

  if (!staffUser) return <div style={{ padding: 32 }}>Loading&hellip;</div>

  return (
    <div style={{ padding: '24px 28px', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, alignItems: 'flex-start' }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 16px' }}>Calendar</h1>
        <CalendarView userId={staffUser.id} />
      </div>
      <TodoWidget userId={staffUser.id} />
    </div>
  )
}
