// Small formatting helpers shared by every function that builds an
// email, a Teams post, or a Postgres LIKE pattern from user-supplied
// values (candidate names come straight from the public apply form).

// Escapes a value for interpolation into email HTML, so a candidate
// named `<a href="…">Click here</a>` renders as literal text in staff
// inboxes rather than as a link/markup.
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Only http(s) URLs are allowed into an href — anything else (e.g.
// `javascript:`) is rendered as plain text by the caller.
export function safeHref(url: unknown): string | null {
  const s = String(url ?? '').trim()
  return /^https?:\/\//i.test(s) ? escapeHtml(s) : null
}

// Teams Adaptive Card TextBlocks render a Markdown subset — strip the
// characters that would let a user-supplied name inject a link or
// formatting into the channel post.
export function escapeTeams(value: unknown): string {
  return String(value ?? '').replace(/[\\`*_[\]()<>#~|]/g, '')
}

// Escapes LIKE/ILIKE wildcards so an ilike() comparison is an exact,
// case-insensitive match. Without this, "a_b@x.com" matches "aXb@x.com".
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`)
}

// Edge Functions run in UTC, so an unqualified toLocaleString() prints a
// UTC wall-clock time with no label. Format in the org's timezone
// (APP_TIMEZONE secret, an IANA name like "Africa/Lagos") and always
// include the zone abbreviation so the reader knows what it means.
// (dateStyle/timeStyle can't be combined with timeZoneName, hence the
// explicit fields.)
export function formatWhen(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }
  try {
    return new Date(value).toLocaleString('en-US', { ...options, timeZone: Deno.env.get('APP_TIMEZONE') || 'UTC' })
  } catch {
    // Invalid APP_TIMEZONE — fall back to an explicitly-labelled UTC time.
    return new Date(value).toLocaleString('en-US', { ...options, timeZone: 'UTC' })
  }
}
