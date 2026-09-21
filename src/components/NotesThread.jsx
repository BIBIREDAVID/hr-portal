import { useEffect, useRef, useState } from 'react'
import { createNote, listNotesForApplication, parseMentions } from '../lib/notes'
import { createNotification } from '../lib/notifications'
import { InlineLoader } from './Spinner'

function timeAgo(isoString) {
  const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

// Notes thread per application, with @mentions (Section 6). Typing "@"
// opens a suggestion list of staff users; picking one inserts their
// full name so `parseMentions` can find it again on submit.
export default function NotesThread({ applicationId, currentUser, staffUsers, candidateName, jobTitle }) {
  const [notes, setNotes] = useState(null)
  const [body, setBody] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [error, setError] = useState(null)
  const [posting, setPosting] = useState(false)
  const textareaRef = useRef(null)

  async function refresh() {
    try {
      setNotes(await listNotesForApplication(applicationId))
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId])

  function handleChange(e) {
    const value = e.target.value
    setBody(value)

    const cursor = e.target.selectionStart
    const upToCursor = value.slice(0, cursor)
    const match = upToCursor.match(/@([\w]*)$/)
    if (match) {
      const query = match[1].toLowerCase()
      setSuggestions(staffUsers.filter((u) => u.name.toLowerCase().includes(query)))
    } else {
      setSuggestions([])
    }
  }

  function insertMention(user) {
    const cursor = textareaRef.current?.selectionStart ?? body.length
    const upToCursor = body.slice(0, cursor)
    const replaced = upToCursor.replace(/@([\w]*)$/, `@${user.name} `)
    setBody(replaced + body.slice(cursor))
    setSuggestions([])
    textareaRef.current?.focus()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!body.trim()) return
    setError(null)
    setPosting(true)
    try {
      const mentionedUserIds = parseMentions(body, staffUsers)
      await createNote({ applicationId, authorId: currentUser.id, body: body.trim(), mentionedUserIds })

      for (const userId of mentionedUserIds) {
        if (userId === currentUser.id) continue
        await createNotification({
          userId,
          type: 'mention',
          referenceId: applicationId,
          message: `${currentUser.name} mentioned you in a note on ${candidateName}'s application for ${jobTitle}`,
        })
      }

      setBody('')
      refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setPosting(false)
    }
  }

  return (
    <div style={{ border: '1px solid #E7EBF1', borderRadius: 12, background: '#fff', boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 6px 16px rgba(15,23,42,0.05)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#94A3B8' }}>
        Notes
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 260, overflowY: 'auto' }}>
        {notes === null && <InlineLoader />}
        {notes?.length === 0 && <div style={{ fontSize: 12.5, color: '#94A3B8' }}>No notes yet.</div>}
        {notes?.map((note) => (
          <div key={note.id} style={{ display: 'flex', gap: 8 }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 999,
                background: '#48418A',
                color: '#fff',
                fontSize: 10,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: '0 0 auto',
              }}
            >
              {note.author?.name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700 }}>
                {note.author?.name ?? 'Unknown'} <span style={{ fontWeight: 500, color: '#94A3B8', fontSize: 11 }}>&middot; {timeAgo(note.created_at)}</span>
              </div>
              <div style={{ fontSize: 12.5, color: '#475569', marginTop: 2, whiteSpace: 'pre-wrap' }}>{note.body}</div>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {suggestions.length > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              marginBottom: 4,
              background: '#fff',
              border: '1px solid #E7EBF1',
              borderRadius: 8,
              boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
              overflow: 'hidden',
              zIndex: 1,
            }}
          >
            {suggestions.map((u) => (
              <div
                key={u.id}
                onClick={() => insertMention(u)}
                style={{ padding: '7px 12px', fontSize: 12.5, cursor: 'pointer' }}
                onMouseDown={(e) => e.preventDefault()}
              >
                {u.name}
              </div>
            ))}
          </div>
        )}
        <textarea
          ref={textareaRef}
          rows={2}
          placeholder="Add a note, @mention a teammate…"
          value={body}
          onChange={handleChange}
          style={{ padding: '9px 11px', border: '1px solid #E7EBF1', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
        />
        {error && <div style={{ fontSize: 12, color: '#EF4444' }}>{error}</div>}
        <button
          type="submit"
          disabled={posting || !body.trim()}
          style={{
            alignSelf: 'flex-start',
            background: '#48418A',
            color: '#fff',
            fontWeight: 700,
            fontSize: 12.5,
            padding: '7px 14px',
            borderRadius: 7,
            border: 'none',
            cursor: posting ? 'default' : 'pointer',
            opacity: posting ? 0.7 : 1,
          }}
        >
          {posting ? 'Posting…' : 'Post note'}
        </button>
      </form>
    </div>
  )
}
