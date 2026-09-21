import { createContext, useContext, useState, useCallback } from 'react'
import { supabase } from './supabaseClient'
import { logActivity } from './activityLog'
import { useAuth } from './AuthContext'

// Admin-only "view as" shadow: narrows what admin-only screens show to
// what the given staff member would see (their own assigned
// applications/interviews), without any permission or session change —
// admin still has full RLS read access underneath. Purely a client-side
// filter, logged to activity_log on entry/exit for auditability.
const AdminViewAsContext = createContext(undefined)

export function AdminViewAsProvider({ children }) {
  const { staffUser } = useAuth()
  const [viewingAs, setViewingAs] = useState(null) // { id, name, role } | null

  const startViewAs = useCallback(
    async (targetStaff) => {
      if (staffUser?.role !== 'admin') return
      setViewingAs(targetStaff)
      await logActivity({
        applicationId: null,
        actorId: staffUser.id,
        action: `Admin started viewing as ${targetStaff.name} (${targetStaff.role})`,
      })
    },
    [staffUser]
  )

  const stopViewAs = useCallback(async () => {
    if (!viewingAs) return
    await logActivity({
      applicationId: null,
      actorId: staffUser?.id,
      action: `Admin stopped viewing as ${viewingAs.name}`,
    })
    setViewingAs(null)
  }, [viewingAs, staffUser])

  return (
    <AdminViewAsContext.Provider value={{ viewingAs, startViewAs, stopViewAs }}>
      {children}
    </AdminViewAsContext.Provider>
  )
}

export function useAdminViewAs() {
  const ctx = useContext(AdminViewAsContext)
  if (ctx === undefined) {
    throw new Error('useAdminViewAs must be used within an AdminViewAsProvider')
  }
  return ctx
}

// Applications assigned to, or with interviews panel-staffed by, the
// staff member currently being viewed-as — mirrors what that person
// would see under their own role's RLS scoping.
export async function listApplicationsForViewedStaff(staffId) {
  const { data: assigned, error: assignedError } = await supabase
    .from('applications')
    .select('id')
    .eq('assigned_to', staffId)
  if (assignedError) throw assignedError

  const { data: panelRows, error: panelError } = await supabase
    .from('interview_panel')
    .select('interview:interviews(application_id)')
    .eq('user_id', staffId)
  if (panelError) throw panelError

  const ids = new Set(assigned.map((a) => a.id))
  for (const row of panelRows) {
    if (row.interview?.application_id) ids.add(row.interview.application_id)
  }
  return [...ids]
}
