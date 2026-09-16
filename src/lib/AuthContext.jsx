import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const AuthContext = createContext(undefined)

// Ensures a `users` row exists for this authenticated Supabase Auth user.
// The very first user ever to sign in becomes 'admin'; everyone after
// that defaults to 'recruiter'.
//
// Known limitation: if two people sign in for the very first time at
// the same moment, both could see an empty `users` table and both be
// inserted as 'admin'. Acceptable for Phase 1 (single-org bootstrap);
// revisit with a server-side lock (e.g. an Edge Function) if that race
// becomes a real concern.
async function syncStaffUser(authUser) {
  const { data: existing, error: selectError } = await supabase
    .from('users')
    .select('*')
    .eq('auth_id', authUser.id)
    .maybeSingle()

  if (selectError) throw selectError
  if (existing) return existing

  const { count, error: countError } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })

  if (countError) throw countError

  const role = count === 0 ? 'admin' : 'recruiter'
  const name =
    authUser.user_metadata?.full_name || authUser.email.split('@')[0]

  const { data: inserted, error: insertError } = await supabase
    .from('users')
    .insert({ auth_id: authUser.id, email: authUser.email, name, role })
    .select()
    .single()

  if (insertError) throw insertError
  return inserted
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [staffUser, setStaffUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true

    async function handleSession(nextSession) {
      setSession(nextSession)
      if (!nextSession) {
        setStaffUser(null)
        setLoading(false)
        return
      }
      try {
        const staff = await syncStaffUser(nextSession.user)
        if (active) setStaffUser(staff)
      } catch (err) {
        if (active) setError(err)
      } finally {
        if (active) setLoading(false)
      }
    }

    supabase.auth.getSession().then(({ data: { session: initial } }) => {
      handleSession(initial)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setLoading(true)
        handleSession(nextSession)
      }
    )

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const value = {
    session,
    staffUser,
    loading,
    error,
    signInWithPassword: (email, password) =>
      supabase.auth.signInWithPassword({ email, password }),
    signOut: () => supabase.auth.signOut(),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (ctx === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
