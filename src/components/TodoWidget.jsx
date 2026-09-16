import { useEffect, useState } from 'react'
import { createTodo, deleteTodo, listTodos, updateTodo } from '../lib/todos'

const inputStyle = {
  padding: '7px 9px',
  border: '1px solid #E7EBF1',
  borderRadius: 6,
  fontSize: 12.5,
  fontFamily: 'inherit',
}

function formatDue(isoString) {
  if (!isoString) return null
  return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// Personal HR to-do list (Section 6/7, item 19) — strictly per-user
// (hr_todos RLS), separate from candidate/application data. Used both
// as a standalone widget (dashboard home) and inside the calendar view.
export default function TodoWidget({ userId }) {
  const [todos, setTodos] = useState(null)
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [error, setError] = useState(null)

  async function refresh() {
    try {
      setTodos(await listTodos(userId))
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  async function handleAdd(e) {
    e.preventDefault()
    if (!title.trim()) return
    try {
      await createTodo({ userId, title: title.trim(), dueAt: dueDate ? new Date(dueDate).toISOString() : null })
      setTitle('')
      setDueDate('')
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  async function toggleComplete(todo) {
    try {
      await updateTodo(todo.id, { completed: !todo.completed })
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete(id) {
    try {
      await deleteTodo(id)
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div style={{ border: '1px solid #E7EBF1', borderRadius: 12, background: '#fff', boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 6px 16px rgba(15,23,42,0.05)', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#94A3B8' }}>
        Your to-dos
      </div>

      {error && <div style={{ fontSize: 12, color: '#EF4444' }}>{error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {todos === null && <div style={{ fontSize: 12.5, color: '#94A3B8' }}>Loading&hellip;</div>}
        {todos?.length === 0 && <div style={{ fontSize: 12.5, color: '#94A3B8' }}>Nothing on your list.</div>}
        {todos?.map((todo) => (
          <div key={todo.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={todo.completed} onChange={() => toggleComplete(todo)} />
            <div style={{ flex: 1, fontSize: 12.5, color: todo.completed ? '#94A3B8' : '#334155', textDecoration: todo.completed ? 'line-through' : 'none' }}>
              {todo.title}
            </div>
            {todo.due_at && <span style={{ fontSize: 11, color: '#94A3B8' }}>{formatDue(todo.due_at)}</span>}
            <button
              onClick={() => handleDelete(todo.id)}
              style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }}
            >
              &times;
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 6 }}>
        <input
          style={{ ...inputStyle, flex: 1 }}
          placeholder="Add a to-do…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input type="date" style={inputStyle} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        <button
          type="submit"
          style={{ background: '#0E87FE', color: '#fff', fontWeight: 700, fontSize: 12, padding: '7px 12px', borderRadius: 6, border: 'none', cursor: 'pointer' }}
        >
          Add
        </button>
      </form>
    </div>
  )
}
