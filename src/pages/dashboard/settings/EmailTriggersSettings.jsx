import { useEffect, useState } from 'react'
import { getStageEmailSettings, setStageEmailSettings } from '../../../lib/emailSettings'
import { STAGES } from '../../../lib/applications'
import { PageLoader } from '../../../components/Spinner'

const stageLabels = {
  new: 'New',
  screening: 'Screening',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Rejected',
}

// A candidate already gets emailed on submission and via bulk-reject, so
// automatic per-stage emails are only offered for the stages in between.
const CONFIGURABLE_STAGES = STAGES.filter((s) => s !== 'new' && s !== 'rejected')

export default function EmailTriggersSettings() {
  const [settings, setSettings] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    getStageEmailSettings()
      .then(setSettings)
      .catch((err) => setError(err.message))
  }, [])

  async function handleToggle(stage) {
    const next = { ...settings, [stage]: !settings[stage] }
    setSettings(next)
    setSaving(true)
    try {
      await setStageEmailSettings(next)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (error) {
    return <div style={{ padding: 32, fontSize: 13, color: '#EF4444' }}>{error}</div>
  }
  if (!settings) {
    return <PageLoader />
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 480 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>Stage-change emails</h1>
      <p style={{ fontSize: 13, color: '#94A3B8', margin: '0 0 20px' }}>
        Automatically email a candidate when their application moves to one of these stages.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {CONFIGURABLE_STAGES.map((stage) => (
          <label
            key={stage}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 4px', borderBottom: '1px solid #F1F5F9' }}
          >
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>{stageLabels[stage]}</span>
            <input type="checkbox" checked={!!settings[stage]} onChange={() => handleToggle(stage)} />
          </label>
        ))}
      </div>

      {saving && <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 10 }}>Saving&hellip;</div>}
    </div>
  )
}
