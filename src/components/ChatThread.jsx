import { useEffect, useRef, useState } from 'react'

const POLL_INTERVAL_MS = 15000

function timeAgo(isoString) {
  const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

// Presentational + polling shell shared by both sides of the chat
// (Section 6/9): the HR view on candidate detail and the candidate view
// on the public status page. `viewerType` ('hr' | 'candidate') controls
// bubble alignment; `fetchMessages`/`sendMessage` are injected so this
// component never needs to know whether it's talking to Supabase
// directly (HR, RLS-checked) or through the `chat` Edge Function
// (candidate, token-validated).
export default function ChatThread({ viewerType, fetchMessages, sendMessage, title = 'Chat' }) {
  const [messages, setMessages] = useState(null)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const scrollRef = useRef(null)

  async function refresh() {
    try {
      const data = await fetchMessages()
      setMessages(data)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!body.trim()) return
    setSending(true)
    setError(null)
    try {
      await sendMessage(body.trim())
      setBody('')
      refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ border: '1px solid #E7EBF1', borderRadius: 12, background: '#fff', boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 6px 16px rgba(15,23,42,0.05)', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#94A3B8' }}>{title}</div>

      <div ref={scrollRef} style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
        {messages === null && <div style={{ fontSize: 12.5, color: '#94A3B8' }}>Loading&hellip;</div>}
        {messages?.length === 0 && <div style={{ fontSize: 12.5, color: '#94A3B8' }}>No messages yet.</div>}
        {messages?.map((m) => {
          const isMine = m.sender_type === viewerType
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
              <div
                style={{
                  maxWidth: '80%',
                  background: isMine ? '#48418A' : '#F1F5F9',
                  color: isMine ? '#fff' : '#334155',
                  borderRadius: 10,
                  padding: '8px 12px',
                  fontSize: 12.5,
                }}
              >
                <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div>
                <div style={{ fontSize: 10, marginTop: 3, opacity: 0.7 }}>{timeAgo(m.created_at)}</div>
              </div>
            </div>
          )
        })}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Type a message…"
          style={{ flex: 1, padding: '9px 11px', border: '1px solid #E7EBF1', borderRadius: 8, fontSize: 13, fontFamily: 'inherit' }}
        />
        <button
          type="submit"
          disabled={sending || !body.trim()}
          style={{ background: '#48418A', color: '#fff', fontWeight: 700, fontSize: 12.5, padding: '9px 16px', borderRadius: 8, border: 'none', cursor: sending ? 'default' : 'pointer' }}
        >
          Send
        </button>
      </form>
      {error && <div style={{ fontSize: 12, color: '#EF4444' }}>{error}</div>}
    </div>
  )
}
