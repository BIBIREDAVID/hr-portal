import { useEffect, useState } from 'react'
import { createStage, deleteStage, listStagesForJob, updateStage } from '../lib/interviews'
import { InlineLoader } from './Spinner'

const inputStyle = {
  padding: '7px 9px',
  border: '1px solid #E7EBF1',
  borderRadius: 6,
  fontSize: 13,
}

function CriteriaEditor({ criteria, onChange }) {
  function update(index, patch) {
    onChange(criteria.map((c, i) => (i === index ? { ...c, ...patch } : c)))
  }
  function remove(index) {
    onChange(criteria.filter((_, i) => i !== index))
  }
  function add() {
    onChange([...criteria, { label: '', weight: 1 }])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {criteria.map((c, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            style={{ ...inputStyle, flex: 1 }}
            placeholder="Criterion label"
            value={c.label}
            onChange={(e) => update(i, { label: e.target.value })}
          />
          <input
            type="number"
            min="0"
            step="0.5"
            style={{ ...inputStyle, width: 70 }}
            placeholder="Weight"
            value={c.weight ?? ''}
            onChange={(e) => update(i, { weight: e.target.value ? Number(e.target.value) : 0 })}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        style={{ alignSelf: 'flex-start', background: '#fff', border: '1px solid #E7EBF1', borderRadius: 6, padding: '4px 10px', fontSize: 11.5, fontWeight: 600, color: '#475569', cursor: 'pointer' }}
      >
        + Add criterion
      </button>
    </div>
  )
}

function StageRow({ stage, onSave, onDelete }) {
  const [name, setName] = useState(stage.name)
  const [criteria, setCriteria] = useState(stage.criteria || [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function persist(patch) {
    setSaving(true)
    setError(null)
    try {
      await onSave(stage.id, patch)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ border: '1px solid #E7EBF1', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8' }}>#{stage.order_index}</span>
        <input
          style={{ ...inputStyle, flex: 1, fontWeight: 700 }}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== stage.name && persist({ name: name.trim() })}
        />
        <button
          type="button"
          onClick={() => onDelete(stage.id)}
          style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          Delete stage
        </button>
      </div>
      <CriteriaEditor
        criteria={criteria}
        onChange={(next) => {
          setCriteria(next)
          persist({ criteria: next.filter((c) => c.label.trim()) })
        }}
      />
      {saving && <div style={{ fontSize: 11, color: '#94A3B8' }}>Saving&hellip;</div>}
      {error && <div style={{ fontSize: 11.5, color: '#EF4444' }}>{error}</div>}
    </div>
  )
}

// Per-job interview stage + scorecard criteria editor (Section: job
// interview process). Only usable once a job exists (edit mode) since
// stages hang off job_id — createJob already seeds 3 defaults.
export default function JobStagesEditor({ jobId }) {
  const [stages, setStages] = useState(null)
  const [error, setError] = useState(null)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)

  async function refresh() {
    try {
      setStages(await listStagesForJob(jobId))
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  async function handleSaveStage(id, patch) {
    await updateStage(id, patch)
    await refresh()
  }

  async function handleDeleteStage(id) {
    setError(null)
    try {
      await deleteStage(id)
      await refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleAddStage(e) {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    setError(null)
    try {
      const orderIndex = (stages?.length ?? 0) + 1
      await createStage(jobId, { name: newName.trim(), orderIndex, criteria: [] })
      setNewName('')
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  if (!stages) return <InlineLoader />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {error && <div style={{ fontSize: 12.5, color: '#EF4444' }}>{error}</div>}
      {stages.map((stage) => (
        <StageRow key={stage.id} stage={stage} onSave={handleSaveStage} onDelete={handleDeleteStage} />
      ))}
      <form onSubmit={handleAddStage} style={{ display: 'flex', gap: 8 }}>
        <input
          style={{ ...inputStyle, flex: 1 }}
          placeholder="New stage name, e.g. Panel interview"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button
          type="submit"
          disabled={adding}
          style={{ background: '#48418A', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12.5, fontWeight: 700, cursor: adding ? 'default' : 'pointer' }}
        >
          {adding ? 'Adding…' : '+ Add stage'}
        </button>
      </form>
    </div>
  )
}
