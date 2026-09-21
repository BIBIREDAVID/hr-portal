// Shared by the `apply` and `send-email` functions: prepends a job's
// hero image (set via the job page builder / JobForm) as a banner at
// the top of an outgoing candidate email, when one is set. Kept in
// _shared so both functions render the banner identically rather than
// duplicating the markup.
export function withBanner(html: string, heroImageUrl: string | null | undefined): string {
  if (!heroImageUrl) return html
  const banner = `<img src="${heroImageUrl}" alt="" width="600" style="width:100%;max-width:600px;height:auto;display:block;border-radius:8px;margin-bottom:20px;" />`
  return banner + html
}
