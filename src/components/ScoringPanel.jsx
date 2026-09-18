import { useState } from 'react'
import { STAGES } from '../lib/applications'

const stageLabels = {
  new: 'New',
  screening: 'Screening',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Rejected',
}

const inputStyle = {
  padding: '8px 10px',
  border: '1px solid #E7EBF1',
  borderRadius: 8,
  fontSize: 13,
  fontFamily: 'inherit',
}

const labelStyle = { fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#94A3B8' }

// Scoring + pipeline controls for one application: stage, assignment,
// numeric score, score notes, and tags (Section 6: "Manual scoring
// (rubric or single score) + notes", "Manual stage changer", "tags").
export default function ScoringPanel({ application, staffUsers, onSave }) {
  const [stage, setStage] = useState(application.stage)
  const [assignedTo, setAssignedTo] = useState(application.assigned_to ?? '')
  const [score, setScore] = useState(application.score ?? '')
  const [scoreNotes, setScoreNotes] = useState(application.score_notes ?? '')
  const [rating, setRating] = useState(application.rating ?? null)
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState(application.tags ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function persist(patch) {
    setError(null)
    setSaving(true)
    try {
      await onSave(patch)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function handleStageChange(e) {
    const next = e.target.value
    setStage(next)
    persist({ stage: next })
  }

  function handleAssignedToChange(e) {
    const next = e.target.value || null
    setAssignedTo(next ?? '')
    persist({ assigned_to: next })
  }

  function handleScoreSave() {
    persist({
      score: score === '' ? null : Number(score),
      score_notes: scoreNotes.trim() || null,
    })
  }

  function handleRatingClick(n) {
    const next = rating === n ? null : n
    setRating(next)
    persist({ rating: next })
  }

  function addTag() {
    const value = tagInput.trim()
    if (!value || tags.includes(value)) return
    const next = [...tags, value]
    setTags(next)
    setTagInput('')
    persist({ tags: next })
  }

  function removeTag(tag) {
    const next = tags.filter((t) => t !== tag)
    setTags(next)
    persist({ tags: next })
  }

  return (
    <div style={{ border: '1px solid #E7EBF1', borderRadius: 12, background: '#fff', boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 6px 16px rgba(15,23,42,0.05)', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={labelStyle}>Stage</span>
          <select style={inputStyle} value={stage} onChange={handleStageChange}>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {stageLabels[s]}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={labelStyle}>Assigned to</span>
          <select style={inputStyle} value={assignedTo} onChange={handleAssignedToChange}>
            <option value="">Unassigned</option>
            {staffUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <span style={labelStyle}>Quick rating</span>
        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => handleRatingClick(n)}
              title={`${n} star${n === 1 ? '' : 's'}`}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 20,
                lineHeight: 1,
                padding: 0,
                color: rating != null && n <= rating ? '#F97316' : '#E7EBF1',
              }}
            >
              &#9733;
            </button>
          ))}
        </div>
      </div>

      <div>
        <span style={labelStyle}>Score</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
          <input
            type="number"
            min="0"
            max="10"
            step="0.1"
            style={{ ...inputStyle, width: 80 }}
            value={score}
            onChange={(e) => setScore(e.target.value)}
          />
          <div style={{ flex: 1, height: 8, background: '#E7EBF1', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(Number(score) || 0, 10) * 10}%`, height: '100%', background: '#48418A' }} />
          </div>
        </div>
        <textarea
          rows={3}
          placeholder="Score notes"
          style={{ ...inputStyle, width: '100%', marginTop: 8, resize: 'vertical' }}
          value={scoreNotes}
          onChange={(e) => setScoreNotes(e.target.value)}
        />
        <button
          type="button"
          onClick={handleScoreSave}
          disabled={saving}
          style={{
            marginTop: 8,
            background: '#48418A',
            color: '#fff',
            fontWeight: 700,
            fontSize: 12.5,
            padding: '7px 14px',
            borderRadius: 7,
            border: 'none',
            cursor: saving ? 'default' : 'pointer',
          }}
        >
          Save score
        </button>
      </div>

      <div>
        <span style={labelStyle}>Tags</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
          {tags.map((tag) => (
            <span
              key={tag}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11.5,
                fontWeight: 600,
                background: '#E9E6F2',
                color: '#3F3D69',
                padding: '4px 9px',
                borderRadius: 999,
              }}
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                style={{ background: 'none', border: 'none', color: '#3F3D69', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }}
              >
                &times;
              </button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <input
            style={{ ...inputStyle, flex: 1 }}
            placeholder="Add a tag and press Enter"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addTag()
              }
            }}
          />
          <button
            type="button"
            onClick={addTag}
            style={{ background: '#fff', border: '1px solid #E7EBF1', borderRadius: 7, padding: '7px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
          >
            Add
          </button>
        </div>
      </div>

      {error && <div style={{ fontSize: 12.5, color: '#EF4444' }}>{error}</div>}
      {saving && <div style={{ fontSize: 11.5, color: '#94A3B8' }}>Saving&hellip;</div>}
    </div>
  )
}
