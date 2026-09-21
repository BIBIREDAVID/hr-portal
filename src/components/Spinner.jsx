// Branded loading states — a small inline Spinner for within a panel/row,
// and PageLoader for a full route/section while data is first fetched.
// Centralized so swapping the look later (or adding real skeletons) is a
// one-file change instead of hunting down every "Loading…" string.

export function Spinner({ size = 16, color = '#48418A' }) {
  return (
    <>
      <span
        style={{
          display: 'inline-block',
          width: size,
          height: size,
          border: `${Math.max(2, size / 8)}px solid ${color}22`,
          borderTopColor: color,
          borderRadius: '50%',
          animation: 'hr-spin 0.7s linear infinite',
          verticalAlign: 'middle',
        }}
      />
      <style>{'@keyframes hr-spin { to { transform: rotate(360deg); } }'}</style>
    </>
  )
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 60, color: '#94A3B8', fontSize: 13 }}>
      <Spinner size={18} />
      <span>{label}</span>
    </div>
  )
}

export function InlineLoader({ label = 'Loading…' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94A3B8', fontSize: 12.5 }}>
      <Spinner size={13} />
      <span>{label}</span>
    </div>
  )
}
