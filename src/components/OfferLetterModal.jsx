import { useState } from 'react'
import { Document, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer'
import { logActivity } from '../lib/activityLog'

const styles = StyleSheet.create({
  page: { padding: 56, fontSize: 11, fontFamily: 'Helvetica', color: '#0F172A', lineHeight: 1.5 },
  company: { fontSize: 14, fontWeight: 700, marginBottom: 24 },
  date: { marginBottom: 24, color: '#475569' },
  paragraph: { marginBottom: 12 },
  bold: { fontWeight: 700 },
  signatureBlock: { marginTop: 48, flexDirection: 'row', gap: 40 },
  signatureLine: { borderTop: '1pt solid #0F172A', width: 200, paddingTop: 6, fontSize: 10 },
})

function OfferLetterDocument({ companyName, candidateName, jobTitle, startDate, salary, signerName, additionalTerms }) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.company}>{companyName}</Text>
        <Text style={styles.date}>{new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</Text>

        <Text style={styles.paragraph}>Dear {candidateName},</Text>
        <Text style={styles.paragraph}>
          We are delighted to offer you the position of <Text style={styles.bold}>{jobTitle}</Text> at {companyName}.
          We believe your skills and experience will be a great addition to our team, and we're excited for you to
          get started.
        </Text>
        {startDate && (
          <Text style={styles.paragraph}>
            Your anticipated start date is <Text style={styles.bold}>{startDate}</Text>.
          </Text>
        )}
        {salary && (
          <Text style={styles.paragraph}>
            Your starting compensation will be <Text style={styles.bold}>{salary}</Text>, paid in accordance with our
            standard payroll schedule.
          </Text>
        )}
        {additionalTerms && <Text style={styles.paragraph}>{additionalTerms}</Text>}
        <Text style={styles.paragraph}>
          This offer is contingent upon [any standard conditions, e.g. background check or reference verification].
          Please sign and return this letter to confirm your acceptance.
        </Text>
        <Text style={styles.paragraph}>We look forward to welcoming you aboard.</Text>

        <View style={styles.signatureBlock}>
          <View style={styles.signatureLine}>
            <Text>{signerName || 'Hiring Manager'}</Text>
            <Text>{companyName}</Text>
          </View>
          <View style={styles.signatureLine}>
            <Text>{candidateName}</Text>
            <Text>Date</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}

const inputStyle = {
  padding: '9px 11px',
  border: '1px solid #E7EBF1',
  borderRadius: 8,
  fontSize: 13,
  fontFamily: 'inherit',
  width: '100%',
}

// Client-only offer letter generation (Section 2/9, item 23) — no
// persistence, no offer-letter table (the schema doesn't have one and
// this is explicitly "later/polish" scope, not a source-of-truth
// record). HR fills in the variable terms, gets a PDF to download and
// send however they normally would.
export default function OfferLetterModal({ candidate, application, actorId, onClose }) {
  const [companyName, setCompanyName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [salary, setSalary] = useState('')
  const [signerName, setSignerName] = useState('')
  const [additionalTerms, setAdditionalTerms] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)

  async function handleGenerate() {
    setError(null)
    setGenerating(true)
    try {
      const blob = await pdf(
        <OfferLetterDocument
          companyName={companyName.trim() || 'Your Company'}
          candidateName={candidate.name}
          jobTitle={application.job.title}
          startDate={startDate}
          salary={salary.trim()}
          signerName={signerName.trim()}
          additionalTerms={additionalTerms.trim()}
        />
      ).toBlob()

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Offer Letter - ${candidate.name}.pdf`
      link.click()
      URL.revokeObjectURL(url)

      if (actorId) {
        logActivity({ applicationId: application.id, actorId, action: 'generated an offer letter' })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 480, background: '#fff', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Offer letter for {candidate.name}</h2>
          <p style={{ fontSize: 12.5, color: '#94A3B8', margin: '4px 0 0' }}>{application.job.title}</p>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Company name</span>
          <input style={inputStyle} value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Inc." />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Start date</span>
            <input style={inputStyle} value={startDate} onChange={(e) => setStartDate(e.target.value)} placeholder="March 3, 2026" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Salary</span>
            <input style={inputStyle} value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="$120,000 / year" />
          </label>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Signed by</span>
          <input style={inputStyle} value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="Your name" />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Additional terms (optional)</span>
          <textarea
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
            value={additionalTerms}
            onChange={(e) => setAdditionalTerms(e.target.value)}
          />
        </label>

        {error && <div style={{ fontSize: 12.5, color: '#EF4444' }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={generating}
            style={{ background: '#fff', border: '1px solid #E7EBF1', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              background: '#0E87FE',
              color: '#fff',
              fontWeight: 700,
              fontSize: 13,
              padding: '9px 18px',
              borderRadius: 8,
              border: 'none',
              cursor: generating ? 'default' : 'pointer',
              opacity: generating ? 0.7 : 1,
            }}
          >
            {generating ? 'Generating…' : 'Download PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}
