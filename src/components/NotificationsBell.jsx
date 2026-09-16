import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../lib/notifications'

function timeAgo(isoString) {
  const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

const POLL_INTERVAL_MS = 30000

export default function NotificationsBell() {
  const { staffUser } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  async function refresh() {
    if (!staffUser) return
    try {
      setNotifications(await listNotifications(staffUser.id))
    } catch {
      // notifications are non-critical — fail silently
    }
  }

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffUser?.id])

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const unreadCount = notifications.filter((n) => !n.read).length

  async function handleClickNotification(notification) {
    if (!notification.read) {
      await markNotificationRead(notification.id)
      setNotifications((list) => list.map((n) => (n.id === notification.id ? { ...n, read: true } : n)))
    }
    setOpen(false)
    if (notification.reference_id) {
      navigate(`/dashboard/applications/${notification.reference_id}`)
    }
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead(staffUser.id)
    setNotifications((list) => list.map((n) => ({ ...n, read: true })))
  }

  if (!staffUser) return null

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          position: 'relative',
          background: '#fff',
          border: '1px solid #E7EBF1',
          borderRadius: 8,
          width: 34,
          height: 34,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
        aria-label="Notifications"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              background: '#EF4444',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              borderRadius: 999,
              minWidth: 16,
              height: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 3px',
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 6,
            width: 320,
            maxHeight: 380,
            overflowY: 'auto',
            background: '#fff',
            border: '1px solid #E7EBF1',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(15,23,42,0.1)',
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid #E7EBF1' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>Notifications</div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{ background: 'none', border: 'none', color: '#0E87FE', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}
              >
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 && (
            <div style={{ padding: '20px 14px', fontSize: 12.5, color: '#94A3B8', textAlign: 'center' }}>You're all caught up.</div>
          )}

          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => handleClickNotification(n)}
              style={{
                padding: '10px 14px',
                borderBottom: '1px solid #F1F5F9',
                cursor: 'pointer',
                background: n.read ? '#fff' : '#F0F7FF',
                display: 'flex',
                gap: 8,
              }}
            >
              {!n.read && <div style={{ width: 6, height: 6, borderRadius: 999, background: '#0E87FE', marginTop: 5, flex: '0 0 auto' }} />}
              <div>
                <div style={{ fontSize: 12.5, color: '#334155' }}>{n.message}</div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{timeAgo(n.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
