import { supabase } from './supabaseClient'
import { STAGES } from './applications'

// Stages that count as forward progress through the pipeline — excludes
// 'rejected', which is a dropout, not a funnel step.
const FUNNEL_STAGES = STAGES.filter((s) => s !== 'rejected')

// Counts + stage-to-stage conversion rate for one job (Section 6/7,
// item 19). Aggregated client-side from the raw rows — fine at the
// scale of one org's applications, and avoids needing a Postgres
// aggregate RPC for something this simple.
export async function getJobFunnel(jobId) {
  const { data, error } = await supabase.from('applications').select('stage').eq('job_id', jobId)
  if (error) throw error

  const counts = Object.fromEntries(STAGES.map((s) => [s, 0]))
  for (const row of data) counts[row.stage] = (counts[row.stage] ?? 0) + 1

  const total = data.length
  let previousCount = total
  const funnel = FUNNEL_STAGES.map((stage) => {
    const count = counts[stage]
    const conversionFromPrevious = previousCount > 0 ? count / previousCount : 0
    const conversionFromStart = total > 0 ? count / total : 0
    previousCount = count
    return { stage, count, conversionFromPrevious, conversionFromStart }
  })

  return { total, rejected: counts.rejected, funnel }
}

// Applications sitting in a non-terminal stage longer than
// `thresholdDays` (item 20).
export async function getTimeInStageFlags(thresholdDays) {
  const { data, error } = await supabase
    .from('applications')
    .select('id, stage, stage_updated_at, candidate:candidates(id,name), job:jobs(id,title)')
    .not('stage', 'in', '(hired,rejected)')
    .order('stage_updated_at', { ascending: true })
  if (error) throw error

  const now = Date.now()
  return data
    .map((app) => ({
      ...app,
      daysInStage: Math.floor((now - new Date(app.stage_updated_at).getTime()) / (1000 * 60 * 60 * 24)),
    }))
    .filter((app) => app.daysInStage >= thresholdDays)
    .sort((a, b) => b.daysInStage - a.daysInStage)
}

// Application counts by candidate source, bucketed by outcome (item 21:
// "source tracking ... outcomes"). `in_progress` is anything not yet
// hired or rejected.
export async function getSourceBreakdown() {
  const { data, error } = await supabase.from('applications').select('stage, candidate:candidates(source)')
  if (error) throw error

  const breakdown = {
    public_application: { hired: 0, rejected: 0, in_progress: 0 },
    hr_upload: { hired: 0, rejected: 0, in_progress: 0 },
  }

  for (const row of data) {
    const source = row.candidate?.source
    if (!breakdown[source]) continue
    const bucket = row.stage === 'hired' ? 'hired' : row.stage === 'rejected' ? 'rejected' : 'in_progress'
    breakdown[source][bucket] += 1
  }

  return breakdown
}
