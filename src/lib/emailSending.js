import { supabase } from './supabaseClient'
import { getStageEmailSettings } from './emailSettings'

export const REJECTION_TEMPLATE = {
  subject: 'Update on your application for {{job_title}}',
  body: `Hi {{candidate_name}},

Thank you for taking the time to apply for {{job_title}} and for speaking with our team. After careful consideration, we've decided to move forward with other candidates for this role.

We know this isn't the news you were hoping for, and we appreciate the effort you put into your application. We'll keep your information on file for future openings that may be a better fit.

Best of luck in your search.`,
}

export const STAGE_CHANGE_TEMPLATE = {
  subject: 'Your application for {{job_title}} has moved to {{stage}}',
  body: `Hi {{candidate_name}},

Good news — your application for {{job_title}} has moved to the {{stage}} stage. We'll be in touch with next steps soon.

You can check your status any time: {{status_url}}`,
}

// Sends `subject`/`body` (with {{candidate_name}}, {{job_title}},
// {{stage}}, {{status_url}} placeholders) to each application's
// candidate via the `send-email` Edge Function, and logs each send to
// `email_log`. Only reachable by admin/recruiter — enforced server-side
// by the function itself, not just by hiding the button here.
export async function sendTemplatedEmail({ applicationIds, type, subject, body }) {
  const { data, error } = await supabase.functions.invoke('send-email', {
    body: { application_ids: applicationIds, type, subject, body },
  })
  if (error) {
    const message = await error.context?.json?.().then((b) => b?.error).catch(() => null)
    throw new Error(message || error.message)
  }
  return data
}

// Call after a stage change to fire the configurable per-stage email
// (Section 7, item 18) if HR has turned it on for that stage. Silently
// does nothing if it's off, and never throws — a failed notification
// email shouldn't block or roll back the stage change itself.
export async function maybeSendStageChangeEmail(applicationIds, stage) {
  try {
    const settings = await getStageEmailSettings()
    if (!settings[stage]) return
    await sendTemplatedEmail({
      applicationIds,
      type: 'stage_change',
      subject: STAGE_CHANGE_TEMPLATE.subject,
      body: STAGE_CHANGE_TEMPLATE.body,
    })
  } catch (err) {
    console.error('stage-change email failed', err)
  }
}
