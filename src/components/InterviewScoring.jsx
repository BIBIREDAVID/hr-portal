import { useEffect, useState } from 'react'
import { averageScoresByCriterion, listScoresForInterview, recordScore } from '../lib/interviews'
import { InlineLoader } from './Spinner'

const inputStyle = {
  padding: '6px 8px',
  border: '1px solid #E7EBF1',
  borderRadius: 6,
  fontSize: 12.5,
  fontFamily: 'inherit',
}

const labelStyle = { fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#94A3B8' }

// Per-criterion scoring for a panelist (Section: interview scoring).
// Criteria come from the interview's stage; only a current panelist can
// enter their own score, but averages are visible to anyone who can see
// the interview at all (RLS already scopes that upstream).
export default function InterviewScoring({ interview, currentUserId, isPanelist }) {
  const criteria = interview.stage?.criteria || []
  const [scores, setScores] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [saving, setSaving] = useState(null)
  const [error, setError] = useState(null)

  async function refresh() {
    try {
      const data = await listScoresForInterview(interview.id)
      setScores(data)
      const own = {}
      for (const s of data) {
        if (s.interviewer_id === currentUserId) {
          own[s.criterion_label] = { score: s.score ?? '', notes: s.notes ?? '' }
        }
      }
      setDrafts((d) => ({ ...own, ...d }))
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interview.id])

  if (criteria.length === 0) return null

  const averages = scores ? averageScoresByCriterion(scores) : {}

  function setDraft(label, patch) {
    setDrafts((d) => ({ ...d, [label]: { ...d[label], ...patch } }))
  }

  async function handleSave(label) {
    setSaving(label)
    setError(null)
    try {
      const draft = drafts[label] || {}
      await recordScore({
        interviewId: interview.id,
        interviewerId: currentUserId,
        criterionLabel: label,
        score: draft.score === '' || draft.score === undefined ? null : Number(draft.score),
        notes: draft.notes?.trim() || null,
      })
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, border: '1px solid #F1F5F9', borderRadius: 7, padding: 8 }}>
      <div style={labelStyle}>Scoring</div>
      {scores === null ? (
        <InlineLoader />
      ) : (
        criteria.map((c) => {
          const draft = drafts[c.label] || { score: '', notes: '' }
          const avg = averages[c.label]
          return (
            <div key={c.label} style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 6, borderBottom: '1px solid #F8FAFC' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#475569' }}>
                  {c.label} {c.weight ? <span style={{ color: '#94A3B8', fontWeight: 500 }}>(weight {c.weight})</span> : null}
                </span>
                <span style={{ fontSize: 12, color: '#48418A', fontWeight: 700 }}>
                  {avg !== undefined ? `avg ${avg.toFixed(1)}` : 'no scores yet'}
                </span>
              </div>
              {isPanelist && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <select
                    value={draft.score}
                    onChange={(e) => setDraft(c.label, { score: e.target.value })}
                    style={{ ...inputStyle, width: 60 }}
                  >
                    <option value="">—</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder="Notes"
                    value={draft.notes}
                    onChange={(e) => setDraft(c.label, { notes: e.target.value })}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => handleSave(c.label)}
                    disabled={saving === c.label}
                    style={{ background: '#48418A', color: '#fff', border: 'none', borderRadius: 6, padding: '0 10px', fontSize: 11.5, fontWeight: 700, cursor: saving === c.label ? 'default' : 'pointer' }}
                  >
                    Save
                  </button>
                </div>
              )}
            </div>
          )
        })
      )}
      {error && <div style={{ fontSize: 11.5, color: '#EF4444' }}>{error}</div>}
    </div>
  )
}
