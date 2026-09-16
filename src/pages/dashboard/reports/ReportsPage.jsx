import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listJobs } from '../../../lib/jobs'
import { getJobFunnel, getSourceBreakdown, getTimeInStageFlags } from '../../../lib/reports'

const stageLabels = {
  new: 'New',
  screening: 'Screening',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Rejected',
}

const stageColors = {
  new: '#0E87FE',
  screening: '#8B5CF6',
  shortlisted: '#8B5CF6',
  interview: '#F97316',
  offer: '#F97316',
  hired: '#16A34A',
}

const panelStyle = {
  border: '1px solid #E7EBF1',
  borderRadius: 10,
  background: '#fff',
  padding: 18,
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
}

const labelStyle = { fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#94A3B8' }

function FunnelSection() {
  const [jobs, setJobs] = useState([])
  const [jobId, setJobId] = useState('')
  const [funnel, setFunnel] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    listJobs().then((j) => {
      setJobs(j)
      if (j.length > 0) setJobId(j[0].id)
    })
  }, [])

  useEffect(() => {
    if (!jobId) return
    getJobFunnel(jobId).then(setFunnel).catch((err) => setError(err.message))
  }, [jobId])

  const maxCount = funnel ? Math.max(funnel.total, 1) : 1

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={labelStyle}>Pipeline funnel</div>
        <select
          value={jobId}
          onChange={(e) => setJobId(e.target.value)}
          style={{ padding: '6px 9px', border: '1px solid #E7EBF1', borderRadius: 7, fontSize: 12.5 }}
        >
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title}
            </option>
          ))}
        </select>
      </div>

      {error && <div style={{ fontSize: 12.5, color: '#EF4444' }}>{error}</div>}

      {funnel && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {funnel.funnel.map(({ stage, count, conversionFromPrevious }) => (
              <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 90, fontSize: 12, color: '#475569' }}>{stageLabels[stage]}</div>
                <div style={{ flex: 1, height: 22, background: '#F1F5F9', borderRadius: 5, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${(count / maxCount) * 100}%`,
                      height: '100%',
                      background: stageColors[stage],
                      minWidth: count > 0 ? 4 : 0,
                    }}
                  />
                </div>
                <div style={{ width: 34, fontSize: 12, fontWeight: 700, textAlign: 'right' }}>{count}</div>
                <div style={{ width: 60, fontSize: 11, color: '#94A3B8', textAlign: 'right' }}>
                  {stage !== 'new' ? `${Math.round(conversionFromPrevious * 100)}%` : ''}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 18 }}>
            <div>
              <div style={{ fontSize: 11, color: '#94A3B8' }}>TOTAL APPLICATIONS</div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{funnel.total}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#94A3B8' }}>REJECTED</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#EF4444' }}>{funnel.rejected}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#94A3B8' }}>NEW &rarr; HIRED</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#16A34A' }}>
                {Math.round((funnel.funnel.find((f) => f.stage === 'hired')?.conversionFromStart ?? 0) * 100)}%
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function TimeInStageSection() {
  const [threshold, setThreshold] = useState(7)
  const [flags, setFlags] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getTimeInStageFlags(threshold)
      .then(setFlags)
      .catch((err) => setError(err.message))
  }, [threshold])

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={labelStyle}>Time-in-stage flags</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#475569' }}>
          Stuck for
          <input
            type="number"
            min="0"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
            style={{ width: 48, padding: '5px 7px', border: '1px solid #E7EBF1', borderRadius: 6, fontSize: 12.5 }}
          />
          + days
        </label>
      </div>

      {error && <div style={{ fontSize: 12.5, color: '#EF4444' }}>{error}</div>}
      {flags?.length === 0 && <div style={{ fontSize: 12.5, color: '#94A3B8' }}>Nothing stuck — pipeline's moving.</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {flags?.map((app) => (
          <Link
            key={app.id}
            to={`/dashboard/candidates/${app.candidate.id}`}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '9px 12px',
              border: '1px solid #F1F5F9',
              borderRadius: 8,
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{app.candidate.name}</div>
              <div style={{ fontSize: 11.5, color: '#94A3B8' }}>{app.job.title}</div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#EF4444', background: '#FDEAEA', padding: '3px 9px', borderRadius: 999 }}>
              {app.daysInStage}d in {stageLabels[app.stage]}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

function SourceTrackingSection() {
  const [breakdown, setBreakdown] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getSourceBreakdown().then(setBreakdown).catch((err) => setError(err.message))
  }, [])

  const sourceLabels = { public_application: 'Public application', hr_upload: 'HR upload' }

  return (
    <div style={panelStyle}>
      <div style={labelStyle}>Source tracking</div>
      {error && <div style={{ fontSize: 12.5, color: '#EF4444' }}>{error}</div>}
      {breakdown &&
        Object.entries(breakdown).map(([source, counts]) => {
          const total = counts.hired + counts.rejected + counts.in_progress
          return (
            <div key={source} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{sourceLabels[source]}</span>
                <span style={{ fontSize: 12, color: '#94A3B8' }}>{total} total</span>
              </div>
              <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', background: '#F1F5F9' }}>
                {total > 0 && (
                  <>
                    <div style={{ width: `${(counts.hired / total) * 100}%`, background: '#16A34A' }} />
                    <div style={{ width: `${(counts.in_progress / total) * 100}%`, background: '#0E87FE' }} />
                    <div style={{ width: `${(counts.rejected / total) * 100}%`, background: '#EF4444' }} />
                  </>
                )}
              </div>
              <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: '#475569' }}>
                <span>&#9679; Hired {counts.hired}</span>
                <span>&#9679; In progress {counts.in_progress}</span>
                <span>&#9679; Rejected {counts.rejected}</span>
              </div>
            </div>
          )
        })}
    </div>
  )
}

export default function ReportsPage() {
  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Reports</h1>
        <p style={{ fontSize: 13, color: '#94A3B8', margin: '2px 0 0' }}>Pipeline health across jobs</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <FunnelSection />
        <SourceTrackingSection />
      </div>

      <TimeInStageSection />
    </div>
  )
}
