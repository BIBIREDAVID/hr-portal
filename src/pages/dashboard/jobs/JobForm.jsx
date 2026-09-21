import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createJob, getJob, updateJob, uploadJobHeroImage } from '../../../lib/jobs'
import { useAuth } from '../../../lib/AuthContext'
import CustomFieldsEditor from '../../../components/CustomFieldsEditor'
import LabelListEditor from '../../../components/LabelListEditor'
import JobPageContent from '../../../components/JobPageContent'
import { PageLoader } from '../../../components/Spinner'

const emptyJob = {
  title: '',
  department: '',
  description: '',
  requirements: '',
  status: 'draft',
  expires_at: '',
  custom_fields: [],
  scorecard_template: [],
  headline: '',
  hero_image_url: '',
  benefits: [],
  tasks: [],
  requirements_list: [],
  locations: [],
  work_mode: 'onsite',
}

const inputStyle = {
  padding: '9px 11px',
  border: '1px solid #E7EBF1',
  borderRadius: 8,
  fontSize: 14,
  fontFamily: 'inherit',
}

const labelStyle = { fontSize: 12.5, fontWeight: 600, color: '#475569' }

// `expires_at` is a timestamptz; <input type="datetime-local"> needs
// "YYYY-MM-DDTHH:mm" with no timezone suffix.
function toDateTimeLocal(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function JobForm({ mode }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { staffUser } = useAuth()

  const [job, setJob] = useState(emptyJob)
  const [loading, setLoading] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [locationInput, setLocationInput] = useState('')
  const [uploadingHero, setUploadingHero] = useState(false)
  const [previewWidth, setPreviewWidth] = useState('desktop')

  useEffect(() => {
    if (mode !== 'edit') return
    getJob(id)
      .then((data) =>
        setJob({
          ...data,
          department: data.department || '',
          description: data.description || '',
          requirements: data.requirements || '',
          expires_at: toDateTimeLocal(data.expires_at),
          custom_fields: data.custom_fields || [],
          scorecard_template: data.scorecard_template || [],
          headline: data.headline || '',
          hero_image_url: data.hero_image_url || '',
          benefits: data.benefits || [],
          tasks: data.tasks || [],
          requirements_list: data.requirements_list || [],
          locations: data.locations || [],
          work_mode: data.work_mode || 'onsite',
        })
      )
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [mode, id])

  function set(field, value) {
    setJob((j) => ({ ...j, [field]: value }))
  }

  function addLocation() {
    const value = locationInput.trim()
    if (!value || job.locations.includes(value)) return
    set('locations', [...job.locations, value])
    setLocationInput('')
  }

  function removeLocation(loc) {
    set('locations', job.locations.filter((l) => l !== loc))
  }

  async function handleHeroImageChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingHero(true)
    setError(null)
    try {
      const url = await uploadJobHeroImage(file)
      set('hero_image_url', url)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploadingHero(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    const payload = {
      title: job.title.trim(),
      department: job.department.trim() || null,
      description: job.description.trim() || null,
      requirements: job.requirements.trim() || null,
      status: job.status,
      expires_at: job.expires_at ? new Date(job.expires_at).toISOString() : null,
      custom_fields: job.custom_fields.filter((f) => f.label.trim()),
      scorecard_template: job.scorecard_template.filter((c) => c.label.trim()),
      headline: job.headline.trim() || null,
      hero_image_url: job.hero_image_url || null,
      benefits: job.benefits.filter((b) => b.label.trim()),
      tasks: job.tasks.filter((t) => t.label.trim()),
      requirements_list: job.requirements_list.filter((r) => r.label.trim()),
      locations: job.locations,
      work_mode: job.work_mode,
    }

    try {
      if (mode === 'edit') {
        await updateJob(id, payload)
      } else {
        await createJob(payload, staffUser?.id)
      }
      navigate('/dashboard/jobs')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <PageLoader />
  }

  return (
    <div style={{ padding: '24px 28px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'flex-start' }}>
      <div style={{ maxWidth: 640 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 20px' }}>
          {mode === 'edit' ? 'Edit job' : 'New job'}
        </h1>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={labelStyle}>Title</span>
            <input required style={inputStyle} value={job.title} onChange={(e) => set('title', e.target.value)} />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={labelStyle}>Department</span>
            <input style={inputStyle} value={job.department} onChange={(e) => set('department', e.target.value)} />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={labelStyle}>Description</span>
            <textarea
              rows={4}
              style={{ ...inputStyle, resize: 'vertical' }}
              value={job.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={labelStyle}>Requirements (free text)</span>
            <textarea
              rows={4}
              style={{ ...inputStyle, resize: 'vertical' }}
              value={job.requirements}
              onChange={(e) => set('requirements', e.target.value)}
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={labelStyle}>Status</span>
              <select style={inputStyle} value={job.status} onChange={(e) => set('status', e.target.value)}>
                <option value="draft">Draft</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={labelStyle}>Expires at (optional)</span>
              <input
                type="datetime-local"
                style={inputStyle}
                value={job.expires_at}
                onChange={(e) => set('expires_at', e.target.value)}
              />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={labelStyle}>Work mode</span>
              <select style={inputStyle} value={job.work_mode} onChange={(e) => set('work_mode', e.target.value)}>
                <option value="onsite">On-site</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={labelStyle}>Locations</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  placeholder="e.g. Lagos"
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addLocation()
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={addLocation}
                  style={{ background: '#fff', border: '1px solid #E7EBF1', borderRadius: 7, padding: '0 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
                >
                  Add
                </button>
              </div>
              {job.locations.length > 0 && (
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
                  {job.locations.map((loc) => (
                    <span
                      key={loc}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, background: '#E9E6F2', color: '#3F3D69', padding: '3px 8px', borderRadius: 999 }}
                    >
                      {loc}
                      <button type="button" onClick={() => removeLocation(loc)} style={{ background: 'none', border: 'none', color: '#3F3D69', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }}>
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={labelStyle}>Custom application fields</span>
            <CustomFieldsEditor fields={job.custom_fields} onChange={(fields) => set('custom_fields', fields)} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={labelStyle}>Interview scorecard criteria</span>
            <p style={{ fontSize: 11.5, color: '#94A3B8', margin: 0 }}>
              Interviewers rate each of these 1-5 per interview, so feedback is comparable across interviewers.
            </p>
            <LabelListEditor
              items={job.scorecard_template}
              onChange={(v) => set('scorecard_template', v)}
              placeholder="e.g. Communication"
            />
          </div>

          <div style={{ height: 1, background: '#E7EBF1', margin: '4px 0' }} />
          <div style={{ fontSize: 13, fontWeight: 800 }}>Job page builder</div>
          <p style={{ fontSize: 12, color: '#94A3B8', margin: '-8px 0 0' }}>
            What candidates see on the public application page — preview on the right.
          </p>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={labelStyle}>Headline (optional — falls back to title)</span>
            <input style={inputStyle} placeholder="e.g. Be our technical pioneer" value={job.headline} onChange={(e) => set('headline', e.target.value)} />
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={labelStyle}>Hero image (optional)</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleHeroImageChange} />
            {uploadingHero && <div style={{ fontSize: 12, color: '#94A3B8' }}>Uploading&hellip;</div>}
            {job.hero_image_url && (
              <img src={job.hero_image_url} alt="" style={{ width: 160, borderRadius: 8, marginTop: 4 }} />
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={labelStyle}>Benefits</span>
            <LabelListEditor items={job.benefits} onChange={(v) => set('benefits', v)} placeholder="e.g. Health insurance" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={labelStyle}>Tasks</span>
            <LabelListEditor items={job.tasks} onChange={(v) => set('tasks', v)} placeholder="e.g. UI/UX design (40%)" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={labelStyle}>Requirements (structured bullets)</span>
            <LabelListEditor items={job.requirements_list} onChange={(v) => set('requirements_list', v)} placeholder="e.g. 3+ years with React" />
          </div>

          {error && <div style={{ fontSize: 13, color: '#EF4444' }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                background: '#48418A',
                color: '#fff',
                fontWeight: 700,
                fontSize: 14,
                padding: '10px 18px',
                borderRadius: 8,
                border: 'none',
                cursor: saving ? 'default' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Create job'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard/jobs')}
              style={{ background: '#fff', border: '1px solid #E7EBF1', borderRadius: 8, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      <div style={{ position: 'sticky', top: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={labelStyle}>Live preview</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={() => setPreviewWidth('desktop')}
              style={{ background: previewWidth === 'desktop' ? '#48418A' : '#fff', color: previewWidth === 'desktop' ? '#fff' : '#475569', border: '1px solid #E7EBF1', borderRadius: 6, padding: '4px 10px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}
            >
              Desktop
            </button>
            <button
              type="button"
              onClick={() => setPreviewWidth('mobile')}
              style={{ background: previewWidth === 'mobile' ? '#48418A' : '#fff', color: previewWidth === 'mobile' ? '#fff' : '#475569', border: '1px solid #E7EBF1', borderRadius: 6, padding: '4px 10px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}
            >
              Mobile
            </button>
          </div>
        </div>
        <div
          style={{
            width: previewWidth === 'mobile' ? 375 : '100%',
            maxWidth: '100%',
            margin: previewWidth === 'mobile' ? '0 auto' : 0,
            border: '1px solid #E7EBF1',
            borderRadius: 12,
            background: '#fff',
            padding: 24,
            maxHeight: '80vh',
            overflowY: 'auto',
          }}
        >
          <JobPageContent job={job} />
        </div>
      </div>
    </div>
  )
}
