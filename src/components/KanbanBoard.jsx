import { Link } from 'react-router-dom'
import { STAGES } from '../lib/applications'

const stageMeta = {
  new: { label: 'New', color: '#475569', bg: '#E7EBF1' },
  screening: { label: 'Screening', color: '#8B5CF6', bg: '#F1EBFF' },
  shortlisted: { label: 'Shortlisted', color: '#0A6BCB', bg: '#E7F2FF' },
  interview: { label: 'Interview', color: '#F97316', bg: '#FFEEE2' },
  offer: { label: 'Offer', color: '#F97316', bg: '#FFEEE2' },
  hired: { label: 'Hired', color: '#16A34A', bg: '#E6F7EC' },
  rejected: { label: 'Rejected', color: '#EF4444', bg: '#FDEAEA' },
}

function initials(name) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

// Groups applications into stage columns. Moving a card between stages
// is done via the per-card stage select rather than drag-and-drop — a
// deliberate scope cut to keep this phase's interaction surface small.
export default function KanbanBoard({ applications, onStageChange }) {
  const byStage = STAGES.reduce((acc, stage) => {
    acc[stage] = applications.filter((a) => a.stage === stage)
    return acc
  }, {})

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${STAGES.length}, minmax(0, 1fr))`, gap: 14 }}>
      {STAGES.map((stage) => {
        const meta = stageMeta[stage]
        const items = byStage[stage]
        return (
          <div key={stage} style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: meta.color }}>{meta.label.toUpperCase()}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: meta.color, background: meta.bg, padding: '2px 7px', borderRadius: 999 }}>
                {items.length}
              </div>
            </div>

            {items.map((app) => (
              <div
                key={app.id}
                style={{
                  background: '#fff',
                  border: '1px solid #E7EBF1',
                  borderRadius: 12,
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.05)',
                }}
              >
                <Link to={`/dashboard/candidates/${app.candidate.id}`} style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'inherit', textDecoration: 'none' }}>
                  <div style={{ width: 26, height: 26, borderRadius: 999, background: meta.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 800, flex: '0 0 auto' }}>
                    {initials(app.candidate.name)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.candidate.name}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.job.title}</div>
                  </div>
                </Link>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <select
                    value={app.stage}
                    onChange={(e) => onStageChange(app.id, e.target.value)}
                    style={{ fontSize: 11, border: '1px solid #E7EBF1', borderRadius: 6, padding: '3px 5px' }}
                  >
                    {STAGES.map((s) => (
                      <option key={s} value={s}>
                        {stageMeta[s].label}
                      </option>
                    ))}
                  </select>
                  {app.score != null && <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>{app.score}</span>}
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
