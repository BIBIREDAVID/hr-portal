import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { listJobs } from '../../lib/jobs'
import { listApplications, STAGES } from '../../lib/applications'
import { listInterviews } from '../../lib/interviews'
import TodoWidget from '../../components/TodoWidget'
import { InlineLoader } from '../../components/Spinner'

const FUNNEL_STAGES = STAGES.filter((s) => s !== 'rejected')

// Org-wide version of reports.js's getJobFunnel, computed from the
// applications already loaded for the stat cards rather than a second
// query — same shape (count + conversion from the previous stage and
// from the top of the funnel).
function computeFunnel(applications) {
  const counts = Object.fromEntries(STAGES.map((s) => [s, 0]))
  for (const app of applications) counts[app.stage] = (counts[app.stage] ?? 0) + 1

  const total = applications.length
  let previousCount = total
  return FUNNEL_STAGES.map((stage) => {
    const count = counts[stage]
    const conversionFromPrevious = previousCount > 0 ? count / previousCount : 0
    const conversionFromStart = total > 0 ? count / total : 0
    previousCount = count
    return { stage, count, conversionFromPrevious, conversionFromStart }
  })
}

const cardStyle = {
  border: '1px solid #ECEEF3',
  borderRadius: 12,
  background: '#fff',
  boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.05)',
}

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
  new: { bg: '#E9E6F2', color: '#3F3D69' },
  screening: { bg: '#E7EBF1', color: '#475569' },
  shortlisted: { bg: '#FEF3E0', color: '#B45309' },
  interview: { bg: '#E0F0FE', color: '#0369A1' },
  offer: { bg: '#F3E8FF', color: '#7E22CE' },
  hired: { bg: '#E6F7EC', color: '#16A34A' },
  rejected: { bg: '#FDEAEA', color: '#EF4444' },
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function StatCard({ label, value, accent }) {
  return (
    <div style={{ ...cardStyle, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#94A3B8' }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: accent || '#0F172A' }}>{value}</div>
    </div>
  )
}

function formatDateTime(iso) {
  if (!iso) return 'Time TBD'
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function formatRelativeDate(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

export default function DashboardHome() {
  const { staffUser } = useAuth()
  const isStaffAdmin = staffUser?.role === 'admin' || staffUser?.role === 'recruiter'

  const [stats, setStats] = useState(null)
  const [upcomingInterviews, setUpcomingInterviews] = useState(null)
  const [recentApplications, setRecentApplications] = useState(null)
  const [funnel, setFunnel] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!staffUser) return
    let active = true

    async function load() {
      try {
        const [jobs, interviews, applications] = await Promise.all([
          listJobs().catch(() => []),
          listInterviews().catch(() => []),
          isStaffAdmin ? listApplications().catch(() => []) : Promise.resolve([]),
        ])
        if (!active) return

        const now = Date.now()
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
        const in7Days = now + 7 * 24 * 60 * 60 * 1000

        const upcoming = interviews
          .filter((i) => i.status === 'scheduled' && i.scheduled_at && new Date(i.scheduled_at).getTime() >= now)
          .slice(0, 5)

        const interviewsThisWeek = interviews.filter(
          (i) => i.status === 'scheduled' && i.scheduled_at && new Date(i.scheduled_at).getTime() >= now && new Date(i.scheduled_at).getTime() <= in7Days
        ).length

        setStats({
          openJobs: jobs.filter((j) => j.status === 'open').length,
          activePipeline: applications.filter((a) => !['hired', 'rejected'].includes(a.stage)).length,
          hiredThisMonth: applications.filter((a) => a.stage === 'hired' && new Date(a.stage_updated_at).getTime() >= startOfMonth).length,
          interviewsThisWeek,
        })
        setUpcomingInterviews(upcoming)
        setRecentApplications(applications.slice(0, 6))
        setFunnel(isStaffAdmin ? computeFunnel(applications) : null)
      } catch (err) {
        if (active) setError(err.message)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [staffUser, isStaffAdmin])

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: '#0F172A' }}>
            {greeting()}{staffUser ? `, ${staffUser.name.split(' ')[0]}` : ''}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B' }}>
            {staffUser
              ? `${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} · signed in as ${staffUser.role}`
              : 'Setting up your account…'}
          </p>
        </div>

        {isStaffAdmin && (
          <div style={{ display: 'flex', gap: 10 }}>
            <Link
              to="/dashboard/jobs/new"
              style={{ background: '#48418A', color: '#fff', fontWeight: 700, fontSize: 13, padding: '10px 16px', borderRadius: 8, textDecoration: 'none' }}
            >
              + New job
            </Link>
            <Link
              to="/dashboard/candidates/new"
              style={{ background: '#fff', border: '1px solid #E7EBF1', color: '#3F3D69', fontWeight: 700, fontSize: 13, padding: '10px 16px', borderRadius: 8, textDecoration: 'none' }}
            >
              + Add candidate
            </Link>
          </div>
        )}
      </div>

      {error && <div style={{ fontSize: 13, color: '#EF4444' }}>{error}</div>}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isStaffAdmin ? 'repeat(4, minmax(140px, 1fr))' : 'repeat(2, minmax(140px, 1fr))',
          gap: 14,
        }}
      >
        <StatCard label="Open jobs" value={stats ? stats.openJobs : '—'} />
        {isStaffAdmin && <StatCard label="In pipeline" value={stats ? stats.activePipeline : '—'} accent="#0369A1" />}
        <StatCard label="Interviews this week" value={stats ? stats.interviewsThisWeek : '—'} accent="#B45309" />
        {isStaffAdmin && <StatCard label="Hired this month" value={stats ? stats.hiredThisMonth : '—'} accent="#16A34A" />}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ ...cardStyle, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12, color: '#0F172A' }}>Upcoming interviews</div>
            {upcomingInterviews === null && <InlineLoader />}
            {upcomingInterviews?.length === 0 && (
              <div style={{ fontSize: 12.5, color: '#94A3B8' }}>Nothing scheduled — check the calendar to set one up.</div>
            )}
            {upcomingInterviews?.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {upcomingInterviews.map((iv) => (
                  <div key={iv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F1F3F7' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{iv.application?.candidate?.name || 'Candidate'}</div>
                      <div style={{ fontSize: 12, color: '#94A3B8' }}>{iv.application?.job?.title || '—'}</div>
                    </div>
                    <div style={{ fontSize: 12, color: '#475569', textAlign: 'right' }}>{formatDateTime(iv.scheduled_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {isStaffAdmin && (
            <div style={{ ...cardStyle, padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>Pipeline funnel</div>
                <Link to="/dashboard/reports" style={{ fontSize: 12, fontWeight: 700, color: '#48418A', textDecoration: 'none' }}>
                  Full reports →
                </Link>
              </div>
              {funnel === null && <InlineLoader />}
              {funnel?.every((s) => s.count === 0) && (
                <div style={{ fontSize: 12.5, color: '#94A3B8' }}>No applications yet — the funnel fills in once candidates start applying.</div>
              )}
              {funnel && !funnel.every((s) => s.count === 0) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {funnel.map((s) => {
                    const stage = stageColors[s.stage] ?? stageColors.new
                    const widthPct = Math.max(Math.round(s.conversionFromStart * 100), s.count > 0 ? 4 : 0)
                    return (
                      <div key={s.stage} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 84, fontSize: 12, fontWeight: 600, color: '#475569', flexShrink: 0 }}>
                          {stageLabels[s.stage] ?? s.stage}
                        </div>
                        <div style={{ flex: 1, background: '#F1F3F7', borderRadius: 6, height: 20, position: 'relative', overflow: 'hidden' }}>
                          <div style={{ width: `${widthPct}%`, background: stage.color, height: '100%', borderRadius: 6, transition: 'width 0.3s' }} />
                        </div>
                        <div style={{ width: 84, fontSize: 12, textAlign: 'right', flexShrink: 0 }}>
                          <span style={{ fontWeight: 700, color: '#0F172A' }}>{s.count}</span>
                          <span style={{ color: '#94A3B8' }}> · {Math.round(s.conversionFromStart * 100)}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {isStaffAdmin && (
            <div style={{ ...cardStyle, padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>Recent applications</div>
                <Link to="/dashboard/applications" style={{ fontSize: 12, fontWeight: 700, color: '#48418A', textDecoration: 'none' }}>
                  View all →
                </Link>
              </div>
              {recentApplications === null && <InlineLoader />}
              {recentApplications?.length === 0 && <div style={{ fontSize: 12.5, color: '#94A3B8' }}>No applications yet.</div>}
              {recentApplications?.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {recentApplications.map((app) => {
                    const stage = stageColors[app.stage] ?? stageColors.new
                    return (
                      <Link
                        key={app.id}
                        to={`/dashboard/candidates/${app.candidate?.id}`}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F1F3F7', textDecoration: 'none' }}
                      >
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{app.candidate?.name}</div>
                          <div style={{ fontSize: 12, color: '#94A3B8' }}>
                            {app.job?.title} · {formatRelativeDate(app.created_at)}
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '4px 10px',
                            borderRadius: 999,
                            background: stage.bg,
                            color: stage.color,
                          }}
                        >
                          {stageLabels[app.stage] ?? app.stage}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {staffUser && <TodoWidget userId={staffUser.id} />}
      </div>
    </div>
  )
}
