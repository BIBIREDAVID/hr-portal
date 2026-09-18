import { PublicShell } from '../components/PublicShell'

const sectionStyle = { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }
const headingStyle = { fontSize: 15, fontWeight: 800, margin: 0 }
const bodyStyle = { fontSize: 13.5, color: '#475569', lineHeight: 1.7, margin: 0 }
const listStyle = { fontSize: 13.5, color: '#475569', lineHeight: 1.7, margin: 0, paddingLeft: 20 }

export default function PrivacyPage() {
  return (
    <PublicShell maxWidth={680}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 6px' }}>Privacy &amp; data</h1>
      <p style={{ fontSize: 13.5, color: '#94A3B8', margin: '0 0 32px' }}>
        What we collect when you apply or check your application status, and how it's used.
      </p>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>What we collect</h2>
        <p style={bodyStyle}>When you submit an application, we collect:</p>
        <ul style={listStyle}>
          <li>Your name, email address, and phone number (if provided)</li>
          <li>Your resume file and any portfolio link you share</li>
          <li>Answers to any additional questions the specific job posting asks</li>
          <li>Basic referral information (e.g. which link or campaign brought you here), if present in the URL you arrived from</li>
        </ul>
        <p style={bodyStyle}>
          If you message our hiring team through the status page, we also store those messages so
          the relevant recruiter or interviewer can read and reply to them.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>How it's used</h2>
        <ul style={listStyle}>
          <li>Reviewed by our hiring team to evaluate your application</li>
          <li>Used to send you email updates about your application (confirmation, stage changes, interview scheduling)</li>
          <li>Used to schedule interviews if you're moved forward</li>
        </ul>
        <p style={bodyStyle}>We do not sell your data or share it with third parties for marketing.</p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>Where it's stored</h2>
        <p style={bodyStyle}>
          Your application data is stored in our hiring database (Supabase) and your resume file in
          secure file storage. Emails are sent through our transactional email provider (Resend)
          solely to deliver the messages described above.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>Your access</h2>
        <p style={bodyStyle}>
          Your personal status page (the link emailed to you when you applied) lets you check your
          application's progress at any time, with no account needed. If you'd like your
          application data corrected or removed, contact the hiring team using the message box on
          your status page and we'll act on your request.
        </p>
      </div>
    </PublicShell>
  )
}
