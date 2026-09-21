import { useState } from 'react'
import { analyzeCvForApplication } from '../lib/applications'

const labelStyle = { fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#94A3B8' }

const sourceBadge = {
  library: { bg: '#E6F7EC', color: '#16A34A', label: 'Library' },
  generated: { bg: '#FFEEE2', color: '#F97316', label: 'Generated' },
}

// Rule-based CV flag review (Section: CV analysis). Manual/on-demand —
// runs analyzeCvForApplication (src/lib/cvAnalysis.js under the hood)
// and renders whatever's already saved on application.cv_report.
export default function CvAnalysisPanel({ application, onAnalyzed }) {
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState(null)

  const report = application.cv_report

  async function handleAnalyze() {
    setAnalyzing(true)
    setError(null)
    try {
      const updated = await analyzeCvForApplication(application.id)
      onAnalyzed?.(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div style={{ border: '1px solid #E7EBF1', borderRadius: 12, background: '#fff', boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 6px 16px rgba(15,23,42,0.05)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={labelStyle}>CV analysis</div>
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          style={{ background: 'none', border: 'none', color: '#48418A', fontSize: 12, fontWeight: 700, cursor: analyzing ? 'default' : 'pointer' }}
        >
          {analyzing ? 'Analyzing…' : report ? 'Re-analyze CV' : 'Analyze CV'}
        </button>
      </div>

      {error && <div style={{ fontSize: 12.5, color: '#EF4444' }}>{error}</div>}

      {!report && !analyzing && (
        <div style={{ fontSize: 12.5, color: '#94A3B8' }}>No analysis yet — run it to flag employment gaps, overlaps, and formatting issues.</div>
      )}

      {report && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11, color: '#94A3B8' }}>
            Last analyzed {new Date(report.analyzedAt).toLocaleString()}
          </div>

          {report.gaps?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#F97316' }}>Employment gaps</span>
              {report.gaps.map((g, i) => (
                <div key={i} style={{ fontSize: 12.5, color: '#475569' }}>
                  {g.from} &ndash; {g.to} ({g.months} months)
                </div>
              ))}
            </div>
          )}

          {report.overlaps?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#EF4444' }}>Overlapping roles</span>
              {report.overlaps.map((o, i) => (
                <div key={i} style={{ fontSize: 12.5, color: '#475569' }}>
                  {o.from} &ndash; {o.to}
                </div>
              ))}
            </div>
          )}

          {report.formatIssues?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8' }}>Formatting</span>
              {report.formatIssues.map((issue, i) => (
                <div key={i} style={{ fontSize: 12.5, color: '#475569' }}>
                  {issue}
                </div>
              ))}
            </div>
          )}

          {report.gaps?.length === 0 && report.overlaps?.length === 0 && report.formatIssues?.length === 0 && (
            <div style={{ fontSize: 12.5, color: '#16A34A' }}>No gaps, overlaps, or formatting issues found.</div>
          )}

          {report.suggestedQuestions?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid #F1F5F9', paddingTop: 10 }}>
              <span style={labelStyle}>Suggested questions</span>
              {report.suggestedQuestions.map((sq, i) => {
                const badge = sourceBadge[sq.source] ?? sourceBadge.generated
                return (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, color: '#0F172A' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: badge.color, background: badge.bg, padding: '2px 7px', borderRadius: 999, flex: '0 0 auto', marginTop: 1 }}>
                      {badge.label}
                    </span>
                    <span>{sq.question}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
