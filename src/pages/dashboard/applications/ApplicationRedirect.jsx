import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { getApplication } from '../../../lib/applications'

// Notifications reference an application id (mentions/assignments aren't
// tied to a single candidate view otherwise) — this resolves that id to
// the candidate detail page the notification is actually about.
export default function ApplicationRedirect() {
  const { id } = useParams()
  const [candidateId, setCandidateId] = useState(undefined)

  useEffect(() => {
    getApplication(id)
      .then((app) => setCandidateId(app.candidate.id))
      .catch(() => setCandidateId(null))
  }, [id])

  if (candidateId === undefined) {
    return <div style={{ padding: 32 }}>Loading&hellip;</div>
  }
  if (candidateId === null) {
    return <div style={{ padding: 32, fontSize: 13, color: '#EF4444' }}>That application couldn't be found.</div>
  }
  return <Navigate to={`/dashboard/candidates/${candidateId}`} replace />
}
