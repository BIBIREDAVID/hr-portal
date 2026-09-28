import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const AuthContext = createContext(undefined)

// Loads the `users` row for this authenticated Supabase Auth user.
// The very first user ever to sign in bootstraps the org as 'admin'.
// After that, staff rows are only ever created by an admin through the
// `invite-staff` Edge Function — an Auth login with no staff row (e.g.
// someone who self-signed-up via the public Auth API) gets no access,
// and the DB trigger from migration 0012 rejects a client-side insert
// anyway.
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

  if (count > 0) {
    const err = new Error("Your login isn't linked to a staff account yet. Ask an admin to invite you.")
    throw err
  }

  const role = 'admin'
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
      setError(null)
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
    // The default (global) sign-out revokes the session server-side
    // first, and supabase-js keeps the local session if that request
    // fails (offline, expired refresh token…) — leaving the user stuck
    // signed in. Always fall back to clearing this browser's session.
    signOut: async () => {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) {
        console.error('global sign-out failed, clearing local session', signOutError)
        await supabase.auth.signOut({ scope: 'local' })
      }
    },
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
