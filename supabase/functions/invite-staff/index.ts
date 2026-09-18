// Admin-only staff provisioning — creates a Supabase Auth user plus the
// matching `public.users` row for a new recruiter/interviewer, in one
// step. There's no client-side path for this: creating an auth.users
// row requires the service role key, and only an admin may do it.
//
// Deploy with: supabase functions deploy invite-staff
// Requires SUPABASE_SERVICE_ROLE_KEY (see .env.example). SUPABASE_URL/
// SUPABASE_ANON_KEY are provided automatically by the Edge Functions
// runtime.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ALLOWED_ROLES = ['recruiter', 'interviewer', 'admin']

function generateTempPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(18))
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '')
  return `${b64.slice(0, 16)}!A9`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const callerToken = authHeader.replace('Bearer ', '')
  if (!callerToken) {
    return json({ error: 'Missing Authorization header' }, 401)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // Identify the caller from their JWT and confirm they're an admin —
  // this endpoint must never be reachable by a non-admin, even though
  // it's invoked with the caller's own (anon-scoped) access token.
  const { data: callerAuth, error: callerAuthError } = await supabase.auth.getUser(callerToken)
  if (callerAuthError || !callerAuth?.user) {
    return json({ error: 'Not authenticated' }, 401)
  }

  const { data: callerStaff, error: callerStaffError } = await supabase
    .from('users')
    .select('role')
    .eq('auth_id', callerAuth.user.id)
    .maybeSingle()

  if (callerStaffError) return json({ error: callerStaffError.message }, 500)
  if (!callerStaff || callerStaff.role !== 'admin') {
    return json({ error: 'Only admins can provision staff accounts' }, 403)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const name = String(body.name ?? '').trim()
  const email = String(body.email ?? '').trim().toLowerCase()
  const role = String(body.role ?? '').trim()

  if (!name || !email) {
    return json({ error: 'name and email are required' }, 400)
  }
  if (!EMAIL_RE.test(email)) {
    return json({ error: "That email address doesn't look valid" }, 400)
  }
  if (!ALLOWED_ROLES.includes(role)) {
    return json({ error: `role must be one of: ${ALLOWED_ROLES.join(', ')}` }, 400)
  }

  const tempPassword = generateTempPassword()

  const { data: createdAuthUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  })

  if (createError) {
    const status = createError.message?.toLowerCase().includes('already') ? 409 : 500
    return json({ error: createError.message }, status)
  }

  const { data: staffRow, error: insertError } = await supabase
    .from('users')
    .insert({ auth_id: createdAuthUser.user.id, email, name, role })
    .select()
    .single()

  if (insertError) {
    // Roll back the orphaned auth user rather than leaving a login with
    // no staff profile behind.
    await supabase.auth.admin.deleteUser(createdAuthUser.user.id)
    return json({ error: insertError.message }, 500)
  }

  return json({ staff: staffRow, temp_password: tempPassword }, 201)
})
