// Backs the candidate detail page's prev/next navigation (Section 6/9):
// whichever list of candidates HR was last looking at in the
// Applications view gets stashed here (session-only, per tab) so
// CandidateDetail can page through it without a server round-trip or
// complex cross-route state. A direct link/bookmark to a candidate that
// isn't in the stashed list just hides the nav — there's nothing to
// page through.
const STORAGE_KEY = 'hrportal:candidateNavList'

export function setCandidateNavList(candidateIds) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(candidateIds))
  } catch {
    // sessionStorage can throw in some private-browsing contexts —
    // navigation just degrades to "no list available"
  }
}

export function getCandidateNavList() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}
