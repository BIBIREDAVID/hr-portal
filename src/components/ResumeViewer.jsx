import { useEffect, useState } from 'react'
import { getResumeSignedUrl } from '../lib/resumeStorage'

// `resumePath` is the storage object path (not a URL) stored in
// candidates.resume_url — the bucket is private, so we exchange it for a
// short-lived signed URL on demand rather than storing a public link.
export default function ResumeViewer({ resumePath }) {
  const [signedUrl, setSignedUrl] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    setSignedUrl(null)
    setError(null)
    if (!resumePath) return
    getResumeSignedUrl(resumePath)
      .then(setSignedUrl)
      .catch(() => setError('Could not load resume'))
  }, [resumePath])

  const isPdf = resumePath?.toLowerCase().endsWith('.pdf')

  return (
    <div
      style={{
        border: '1px solid #E7EBF1',
        borderRadius: 12,
        background: '#fff',
        boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 16,
        minHeight: 420,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94A3B8' }}>
          Resume
        </div>
        {signedUrl && (
          <a href={signedUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, fontWeight: 600, color: '#48418A' }}>
            Open / download
          </a>
        )}
      </div>

      {error && <div style={{ fontSize: 13, color: '#EF4444' }}>{error}</div>}

      {!error && !signedUrl && <div style={{ fontSize: 13, color: '#94A3B8' }}>Loading&hellip;</div>}

      {signedUrl && isPdf && (
        <iframe title="Resume preview" src={signedUrl} style={{ flex: 1, minHeight: 380, border: 'none', borderRadius: 6 }} />
      )}

      {signedUrl && !isPdf && (
        <div style={{ fontSize: 13, color: '#64748B' }}>
          Preview isn't available for this file type — use "Open / download" above.
        </div>
      )}
    </div>
  )
}
