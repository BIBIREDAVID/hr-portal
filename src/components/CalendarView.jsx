import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listInterviews } from '../lib/interviews'
import { listTodos } from '../lib/todos'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function buildMonthGrid(monthDate) {
  const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
  const start = new Date(firstOfMonth)
  start.setDate(start.getDate() - start.getDay()) // back up to the preceding Sunday

  const days = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    days.push(d)
  }
  return days
}

// Month grid combining scheduled interviews and personal to-dos
// (Section 6/7, item 18). RLS already scopes `listInterviews()` per
// role (Phase 1/6), so an interviewer sees only their own interviews
// here, same as everywhere else.
export default function CalendarView({ userId }) {
  const [monthDate, setMonthDate] = useState(() => new Date())
  const [interviews, setInterviews] = useState([])
  const [todos, setTodos] = useState([])
  const [selectedDay, setSelectedDay] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([listInterviews(), listTodos(userId)])
      .then(([i, t]) => {
        setInterviews(i)
        setTodos(t)
      })
      .catch((err) => setError(err.message))
  }, [userId])

  const days = useMemo(() => buildMonthGrid(monthDate), [monthDate])

  function itemsForDay(day) {
    const dayInterviews = interviews.filter((i) => i.scheduled_at && sameDay(new Date(i.scheduled_at), day))
    const dayTodos = todos.filter((t) => t.due_at && sameDay(new Date(t.due_at), day))
    return { dayInterviews, dayTodos }
  }

  const selectedItems = selectedDay ? itemsForDay(selectedDay) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>
          {monthDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            style={{ background: '#fff', border: '1px solid #E7EBF1', borderRadius: 6, padding: '5px 10px', fontSize: 12.5, cursor: 'pointer' }}
          >
            &larr;
          </button>
          <button
            onClick={() => setMonthDate(new Date())}
            style={{ background: '#fff', border: '1px solid #E7EBF1', borderRadius: 6, padding: '5px 10px', fontSize: 12.5, cursor: 'pointer' }}
          >
            Today
          </button>
          <button
            onClick={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            style={{ background: '#fff', border: '1px solid #E7EBF1', borderRadius: 6, padding: '5px 10px', fontSize: 12.5, cursor: 'pointer' }}
          >
            &rarr;
          </button>
        </div>
      </div>

      {error && <div style={{ fontSize: 12.5, color: '#EF4444' }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {WEEKDAYS.map((w) => (
          <div key={w} style={{ fontSize: 10.5, fontWeight: 700, color: '#94A3B8', textAlign: 'center', paddingBottom: 4 }}>
            {w}
          </div>
        ))}
        {days.map((day) => {
          const { dayInterviews, dayTodos } = itemsForDay(day)
          const inMonth = day.getMonth() === monthDate.getMonth()
          const isToday = sameDay(day, new Date())
          const isSelected = selectedDay && sameDay(day, selectedDay)
          return (
            <button
              key={day.toISOString()}
              onClick={() => setSelectedDay(day)}
              style={{
                minHeight: 64,
                textAlign: 'left',
                padding: 6,
                borderRadius: 8,
                border: isSelected ? '1.5px solid #48418A' : '1px solid #E7EBF1',
                background: isToday ? '#EFEDF6' : '#fff',
                opacity: inMonth ? 1 : 0.4,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
              }}
            >
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#334155' }}>{day.getDate()}</div>
              {dayInterviews.slice(0, 2).map((i) => (
                <div key={i.id} style={{ fontSize: 9.5, background: '#FFEEE2', color: '#F97316', borderRadius: 4, padding: '1px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {i.application?.candidate?.name ?? 'Interview'}
                </div>
              ))}
              {dayTodos.slice(0, 2).map((t) => (
                <div key={t.id} style={{ fontSize: 9.5, background: '#E9E6F2', color: '#3F3D69', borderRadius: 4, padding: '1px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.title}
                </div>
              ))}
            </button>
          )
        })}
      </div>

      {selectedItems && (
        <div style={{ border: '1px solid #E7EBF1', borderRadius: 12, background: '#fff', boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 6px 16px rgba(15,23,42,0.05)', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>
            {selectedDay.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          {selectedItems.dayInterviews.length === 0 && selectedItems.dayTodos.length === 0 && (
            <div style={{ fontSize: 12.5, color: '#94A3B8' }}>Nothing scheduled.</div>
          )}
          {selectedItems.dayInterviews.map((i) => (
            <Link
              key={i.id}
              to={`/dashboard/candidates/${i.application?.candidate?.id}`}
              style={{ fontSize: 12.5, color: '#334155', textDecoration: 'none', display: 'flex', justifyContent: 'space-between' }}
            >
              <span>
                Interview &mdash; {i.application?.candidate?.name} ({i.application?.job?.title})
              </span>
              <span style={{ color: '#94A3B8' }}>{new Date(i.scheduled_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
            </Link>
          ))}
          {selectedItems.dayTodos.map((t) => (
            <div key={t.id} style={{ fontSize: 12.5, color: t.completed ? '#94A3B8' : '#334155', textDecoration: t.completed ? 'line-through' : 'none' }}>
              To-do &mdash; {t.title}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
