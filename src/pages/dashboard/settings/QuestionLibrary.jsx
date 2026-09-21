import { useEffect, useState } from 'react'
import { useAuth } from '../../../lib/AuthContext'
import {
  createQuestion,
  deleteQuestion,
  listQuestions,
  listRoleCategories,
  updateQuestion,
} from '../../../lib/questionLibrary'
import { InlineLoader } from '../../../components/Spinner'

const inputStyle = {
  padding: '8px 10px',
  border: '1px solid #E7EBF1',
  borderRadius: 7,
  fontSize: 13,
  fontFamily: 'inherit',
}

const labelStyle = { fontSize: 12, fontWeight: 700, color: '#475569' }

const emptyForm = { roleCategory: '', stageName: '', questionText: '', isDefaultForRole: false }

export default function QuestionLibrary() {
  const { staffUser } = useAuth()
  const [questions, setQuestions] = useState(null)
  const [roleCategories, setRoleCategories] = useState([])
  const [filterRole, setFilterRole] = useState('')
  const [filterStage, setFilterStage] = useState('')
  const [error, setError] = useState(null)

  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)

  async function refresh() {
    try {
      const [q, categories] = await Promise.all([
        listQuestions({ roleCategory: filterRole || undefined, stageName: filterStage || undefined }),
        listRoleCategories(),
      ])
      setQuestions(q)
      setRoleCategories(categories)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterRole, filterStage])

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function startEdit(question) {
    setEditingId(question.id)
    setForm({
      roleCategory: question.role_category,
      stageName: question.stage_name || '',
      questionText: question.question_text,
      isDefaultForRole: question.is_default_for_role,
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(emptyForm)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      if (editingId) {
        await updateQuestion(editingId, {
          role_category: form.roleCategory.trim(),
          stage_name: form.stageName.trim() || null,
          question_text: form.questionText.trim(),
          is_default_for_role: form.isDefaultForRole,
        })
      } else {
        await createQuestion({
          roleCategory: form.roleCategory.trim(),
          stageName: form.stageName.trim() || null,
          questionText: form.questionText.trim(),
          isDefaultForRole: form.isDefaultForRole,
          createdBy: staffUser?.id,
        })
      }
      cancelEdit()
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    setError(null)
    try {
      await deleteQuestion(id)
      await refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 900 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>Question library</h1>
      <p style={{ fontSize: 13, color: '#94A3B8', margin: '0 0 24px' }}>
        Reusable interview questions by role and stage, used to suggest questions and populate stages.
      </p>

      <div style={{ background: '#fff', border: '1px solid #E7EBF1', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <h2 style={{ fontSize: 14.5, fontWeight: 800, margin: '0 0 14px' }}>
          {editingId ? 'Edit question' : 'Add a question'}
        </h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
              <span style={labelStyle}>Role category</span>
              <input
                required
                style={inputStyle}
                value={form.roleCategory}
                onChange={(e) => set('roleCategory', e.target.value)}
                placeholder="e.g. Software Engineer"
                list="role-category-options"
              />
              <datalist id="role-category-options">
                {roleCategories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
              <span style={labelStyle}>Stage name (optional)</span>
              <input
                style={inputStyle}
                value={form.stageName}
                onChange={(e) => set('stageName', e.target.value)}
                placeholder="e.g. Screening"
              />
            </label>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={labelStyle}>Question</span>
            <textarea
              required
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
              value={form.questionText}
              onChange={(e) => set('questionText', e.target.value)}
            />
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#475569' }}>
            <input
              type="checkbox"
              checked={form.isDefaultForRole}
              onChange={(e) => set('isDefaultForRole', e.target.checked)}
            />
            Default question for this role
          </label>

          {error && <div style={{ fontSize: 12.5, color: '#EF4444' }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="submit"
              disabled={saving}
              style={{ background: '#48418A', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13.5, fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add question'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                style={{ background: '#fff', border: '1px solid #E7EBF1', borderRadius: 8, padding: '9px 16px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
        <select style={inputStyle} value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
          <option value="">All role categories</option>
          {roleCategories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          style={inputStyle}
          value={filterStage}
          onChange={(e) => setFilterStage(e.target.value)}
          placeholder="Filter by stage name"
        />
      </div>

      {!questions ? (
        <InlineLoader />
      ) : questions.length === 0 ? (
        <div style={{ fontSize: 13, color: '#94A3B8' }}>No questions match these filters.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {questions.map((q) => (
            <div key={q.id} style={{ background: '#fff', border: '1px solid #E7EBF1', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#3F3D69', background: '#E9E6F2', padding: '3px 9px', borderRadius: 999 }}>
                    {q.role_category}
                  </span>
                  {q.stage_name && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', background: '#E7EBF1', padding: '3px 9px', borderRadius: 999 }}>
                      {q.stage_name}
                    </span>
                  )}
                  {q.is_default_for_role && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', background: '#E6F7EC', padding: '3px 9px', borderRadius: 999 }}>
                      Default
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13.5, color: '#0F172A' }}>{q.question_text}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flex: '0 0 auto', alignItems: 'flex-start' }}>
                <button
                  onClick={() => startEdit(q)}
                  style={{ background: '#fff', border: '1px solid #E7EBF1', borderRadius: 6, padding: '5px 10px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(q.id)}
                  style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
