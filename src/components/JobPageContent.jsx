const workModeLabels = { onsite: 'On-site', remote: 'Remote', hybrid: 'Hybrid' }

function Block({ title, items, ctaLabel, onCta }) {
  const visibleItems = items?.filter((i) => i.label?.trim())
  if (!visibleItems || visibleItems.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '20px 0', borderTop: '1px solid #E7EBF1' }}>
      <div style={{ fontSize: 15, fontWeight: 800 }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {visibleItems.map((item, i) => (
          <li key={i} style={{ fontSize: 13, color: '#475569' }}>
            {item.label}
          </li>
        ))}
      </ul>
      {onCta && (
        <button
          type="button"
          onClick={onCta}
          style={{
            alignSelf: 'flex-start',
            background: '#48418A',
            color: '#fff',
            fontWeight: 700,
            fontSize: 12.5,
            padding: '8px 16px',
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            marginTop: 4,
          }}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  )
}

// Renders the job page built in JobForm (headline/hero image/Benefits/
// Tasks/Requirements) — shared between JobForm's live preview and the
// real public /apply/:jobId page so the two never drift apart. `onApply`
// is omitted in preview mode (buttons render but do nothing functional).
export default function JobPageContent({ job, onApply }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {job.hero_image_url && (
        <img
          src={job.hero_image_url}
          alt=""
          style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 12, marginBottom: 20 }}
        />
      )}

      <div style={{ fontSize: 22, fontWeight: 800 }}>{job.headline || job.title}</div>
      <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 6 }}>
        {job.department}
        {job.locations?.length > 0 ? ` · ${job.locations.join(', ')}` : ''}
        {job.work_mode ? ` · ${workModeLabels[job.work_mode]}` : ''}
      </div>

      {job.description && (
        <div style={{ fontSize: 13.5, color: '#475569', marginTop: 16, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
          {job.description}
        </div>
      )}

      {onApply && (
        <button
          type="button"
          onClick={onApply}
          style={{
            alignSelf: 'flex-start',
            marginTop: 18,
            background: '#48418A',
            color: '#fff',
            fontWeight: 700,
            fontSize: 13,
            padding: '10px 20px',
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Apply now
        </button>
      )}

      <Block title="Benefits" items={job.benefits} ctaLabel="Apply now" onCta={onApply} />
      <Block title="What you'll do" items={job.tasks} ctaLabel="Apply now" onCta={onApply} />
      <Block title="Requirements" items={job.requirements_list} ctaLabel="Apply now" onCta={onApply} />
    </div>
  )
}
