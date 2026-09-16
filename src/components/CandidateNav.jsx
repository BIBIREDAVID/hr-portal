import { Link } from 'react-router-dom'
import { getCandidateNavList } from '../lib/candidateNav'

const linkStyle = { fontSize: 12.5, fontWeight: 600, color: '#0E87FE', textDecoration: 'none' }
const disabledStyle = { fontSize: 12.5, fontWeight: 600, color: '#CBD5E1' }

// Prev/next paging through whatever candidate list HR arrived from
// (Section 6/9, item 9). Renders nothing if this candidate isn't part
// of a known list — e.g. a bookmarked link opened directly.
export default function CandidateNav({ currentId }) {
  const list = getCandidateNavList()
  const index = list.indexOf(currentId)
  if (index === -1) return null

  const prevId = index > 0 ? list[index - 1] : null
  const nextId = index < list.length - 1 ? list[index + 1] : null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12.5 }}>
      {prevId ? (
        <Link to={`/dashboard/candidates/${prevId}`} style={linkStyle}>
          &larr; Previous
        </Link>
      ) : (
        <span style={disabledStyle}>&larr; Previous</span>
      )}
      <span style={{ color: '#94A3B8' }}>
        {index + 1} of {list.length}
      </span>
      {nextId ? (
        <Link to={`/dashboard/candidates/${nextId}`} style={linkStyle}>
          Next &rarr;
        </Link>
      ) : (
        <span style={disabledStyle}>Next &rarr;</span>
      )}
    </div>
  )
}
