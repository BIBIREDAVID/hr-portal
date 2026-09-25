// Best-effort poster to a Microsoft Teams channel via a Power Automate
// "Post to a channel when a webhook request is received" workflow. Never
// throws: a Teams outage or missing config should never block the
// caller's real side effects.
//
// Configure by setting the TEAMS_WEBHOOK_URL Edge Function secret to the
// webhook URL from Teams: channel ••• menu -> Workflows -> "Post to a
// channel when a webhook request is received".
//
// That workflow's trigger expects the POST body to be a full Adaptive
// Card object (not a plain `{ text }` payload) — posting anything else
// fails with "Property 'type' must be 'AdaptiveCard'".

export async function notifyTeams(text: string): Promise<boolean> {
  const webhookUrl = Deno.env.get('TEAMS_WEBHOOK_URL')
  if (!webhookUrl) return false

  const card = {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body: [{ type: 'TextBlock', text, wrap: true }],
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    })
    if (!res.ok) {
      console.error('Teams webhook rejected', res.status, await res.text())
      return false
    }
    return true
  } catch (err) {
    console.error('Teams webhook failed', err instanceof Error ? err.message : String(err))
    return false
  }
}
