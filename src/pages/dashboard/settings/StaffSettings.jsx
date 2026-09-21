import { useEffect, useState } from 'react'
import { useAuth } from '../../../lib/AuthContext'
import { STAFF_ROLES, inviteStaff, listStaff, updateStaffRole } from '../../../lib/staff'
import { InlineLoader } from '../../../components/Spinner'

const inputStyle = {
  padding: '9px 11px',
  border: '1px solid #E7EBF1',
  borderRadius: 8,
  fontSize: 13.5,
  fontFamily: 'inherit',
  width: '100%',
}

const labelStyle = { fontSize: 12, fontWeight: 700, color: '#475569' }

const roleBadgeColor = {
  admin: { color: '#16A34A', bg: '#E6F7EC' },
  recruiter: { color: '#3F3D69', bg: '#E9E6F2' },
  interviewer: { color: '#F97316', bg: '#FFEEE2' },
}

export default function StaffSettings() {
  const { staffUser } = useAuth()
  const [staff, setStaff] = useState(null)
  const [loadError, setLoadError] = useState(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('recruiter')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState(null)
  const [created, setCreated] = useState(null)

  const [roleSaving, setRoleSaving] = useState(null)

  function refresh() {
    return listStaff().then(setStaff).catch((err) => setLoadError(err.message))
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleInvite(e) {
    e.preventDefault()
    setInviting(true)
    setInviteError(null)
    setCreated(null)
    try {
      const result = await inviteStaff({ name, email, role })
      setCreated({ email: result.staff.email, tempPassword: result.temp_password })
      setName('')
      setEmail('')
      setRole('recruiter')
      await refresh()
    } catch (err) {
      setInviteError(err.message)
    } finally {
      setInviting(false)
    }
  }

  async function handleRoleChange(person, nextRole) {
    setRoleSaving(person.id)
    try {
      await updateStaffRole(person.id, nextRole)
      await refresh()
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setRoleSaving(null)
    }
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 720 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>Staff accounts</h1>
      <p style={{ fontSize: 13, color: '#94A3B8', margin: '0 0 24px' }}>
        Provision new recruiters or interviewers, and manage existing staff roles.
      </p>

      <div
        style={{
          background: '#fff',
          border: '1px solid #E7EBF1',
          borderRadius: 12,
          padding: 20,
          marginBottom: 28,
        }}
      >
        <h2 style={{ fontSize: 14.5, fontWeight: 800, margin: '0 0 14px' }}>Add a new staff member</h2>

        <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 14 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
              <span style={labelStyle}>Full name</span>
              <input style={inputStyle} required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jamie Ortiz" />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
              <span style={labelStyle}>Email</span>
              <input
                style={inputStyle}
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jamie@company.com"
              />
            </label>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, maxWidth: 220 }}>
            <span style={labelStyle}>Role</span>
            <select style={inputStyle} value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="recruiter">Recruiter</option>
              <option value="interviewer">Interviewer</option>
              <option value="admin">Admin</option>
            </select>
          </label>

          {inviteError && <div style={{ fontSize: 12.5, color: '#EF4444' }}>{inviteError}</div>}

          {created && (
            <div
              style={{
                fontSize: 12.5,
                color: '#166534',
                background: '#E6F7EC',
                border: '1px solid #BBF7D0',
                borderRadius: 8,
                padding: 12,
              }}
            >
              Account created for <strong>{created.email}</strong>. Share this one-time temporary
              password with them so they can sign in and should change it:
              <div style={{ fontFamily: 'monospace', fontSize: 13, marginTop: 6, fontWeight: 700 }}>
                {created.tempPassword}
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={inviting}
              style={{
                background: '#48418A',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '9px 16px',
                fontSize: 13.5,
                fontWeight: 700,
                cursor: inviting ? 'default' : 'pointer',
                opacity: inviting ? 0.7 : 1,
              }}
            >
              {inviting ? 'Creating…' : 'Create account'}
            </button>
          </div>
        </form>
      </div>

      <h2 style={{ fontSize: 14.5, fontWeight: 800, margin: '0 0 14px' }}>Current staff</h2>

      {loadError && <div style={{ fontSize: 12.5, color: '#EF4444', marginBottom: 12 }}>{loadError}</div>}

      {!staff ? (
        <InlineLoader />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {staff.map((person) => {
            const badge = roleBadgeColor[person.role] ?? roleBadgeColor.recruiter
            const isSelf = person.auth_id === staffUser?.auth_id
            return (
              <div
                key={person.id}
                style={{
                  background: '#fff',
                  border: '1px solid #E7EBF1',
                  borderRadius: 10,
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                    {person.name} {isSelf && <span style={{ color: '#94A3B8', fontWeight: 600 }}>(you)</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#94A3B8' }}>{person.email}</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '0 0 auto' }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: badge.color,
                      background: badge.bg,
                      padding: '3px 9px',
                      borderRadius: 999,
                      textTransform: 'capitalize',
                    }}
                  >
                    {person.role}
                  </span>
                  <select
                    value={person.role}
                    disabled={isSelf || roleSaving === person.id}
                    onChange={(e) => handleRoleChange(person, e.target.value)}
                    style={{ fontSize: 12, border: '1px solid #E7EBF1', borderRadius: 6, padding: '4px 6px' }}
                  >
                    {STAFF_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
