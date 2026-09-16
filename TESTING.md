# Testing Guide — HR Interview Portal

This walks through every feature end to end. It assumes the Supabase project is already
set up and migrated, and `npm run dev` is running (see [README.md](README.md) if not).

Some steps require a resume file — any small PDF or DOCX under 5MB works.

---

## 0. One-time setup: three test accounts, three roles

The app has no self-serve signup form and no in-app "change role" UI (by design — Section
4 restricts writes to `users` to the user's own row, or an admin). The **first person ever
to sign in becomes `admin` automatically**; everyone after that defaults to `recruiter`.
To test all three roles you'll need to promote/demote manually via SQL.

1. Go to your Supabase project → **Authentication → Users** → **Add user** (or **Invite**)
   three times, e.g.:
   - `admin@test.com`
   - `recruiter@test.com`
   - `interviewer@test.com`
2. Sign in as `admin@test.com` first in the app (`/login`) — it becomes `admin`
   automatically. Sign out.
3. Sign in as `recruiter@test.com` — becomes `recruiter` automatically (not first anymore).
   Sign out.
4. Sign in as `interviewer@test.com` — also becomes `recruiter` by default. Fix its role
   via the Supabase SQL editor:
   ```sql
   update users set role = 'interviewer' where email = 'interviewer@test.com';
   ```

Keep all three logged in in separate browser profiles/incognito windows if you want to
test cross-role interactions (e.g. assigning `recruiter` to notify them) without
constantly signing in/out.

---

## 1. Auth & route guards (Phase 1)

- [ ] Visiting `/dashboard` while signed out redirects to `/login`.
- [ ] Signing in with valid credentials lands on `/dashboard` and shows "Welcome, `<name>`".
- [ ] Signing in with wrong credentials shows an inline error, doesn't navigate.
- [ ] Sign out (sidebar button) returns you to `/login`, and `/dashboard` immediately
      redirects again.
- [ ] As `interviewer`, the sidebar has no **Settings** link, and visiting `/dashboard/jobs`,
      `/dashboard/jobs/new`, `/dashboard/candidates/new`, `/dashboard/reports`, or
      `/dashboard/settings/email-triggers` directly by URL shows "Not authorized" instead
      of the page.

---

## 2. Jobs & the job page builder (Phase 2 + spec update)

As `admin` or `recruiter`:

- [ ] **Jobs → + New job**: fill in title, department, description, status = `Open`.
- [ ] Add 2+ **custom application fields** (e.g. "Portfolio link" / url / optional).
- [ ] Set **work mode** and add 2+ **locations** (type + Enter, or the Add button) — they
      render as removable chips.
- [ ] **Job page builder**: set a headline, upload a hero image (PNG/JPEG/WEBP), add 2+
      **Benefits**, **Tasks**, and **Requirements** bullets.
- [ ] Confirm the **live preview** on the right updates as you type, and the
      **Desktop/Mobile** toggle actually changes the preview width.
- [ ] Save → redirects to the jobs list, new job appears with correct status badge.
- [ ] **Edit** the job, change the status to `Closed`, save — list reflects the new status.
- [ ] **Delete** a job (confirm dialog) — it disappears from the list.
- [ ] As `interviewer`, confirm **Jobs** isn't reachable (see §1).

---

## 3. Public application flow (Phase 3 + spec update)

Open the job's `/apply/:jobId` URL in an incognito window (no login).

- [ ] The headline, hero image, description, and Benefits/Tasks/Requirements blocks
      render, each with its own **Apply now** button.
- [ ] Clicking any **Apply now** scrolls smoothly to the form.
- [ ] Fill name/email, attach a resume (PDF or DOCX) — after a brief "Reading resume…",
      name/email/phone pre-fill *only if empty* (type something first, then attach a
      resume with different contact info in it, and confirm your typed values are NOT
      overwritten).
- [ ] Fill any custom fields you configured, submit.
- [ ] You're redirected to `/status/:token` showing "Interview"... actually showing stage
      **New**, with the job title/department.
- [ ] Try submitting the *same* email again to the *same* job → should fail with "You've
      already applied to this job."
- [ ] Try a job with `status = draft` or `closed`, or a `Closed`/expired one — `/apply/:jobId`
      should show "This job posting is not available."
- [ ] If `RESEND_API_KEY`/`EMAIL_FROM_ADDRESS` are set: confirm the acknowledgment email
      arrives with a working status link.
- [ ] On the status page, click **"Message HR about this application"** — type a message,
      send it. Confirm it appears in the thread.
- [ ] Back in the dashboard (as `admin`/`recruiter`) on that candidate's detail page,
      confirm the message shows up in **Chat with candidate**, and that a **notification**
      fired for the assigned staff member if one was assigned (see §8).

---

## 4. HR dashboard core (Phase 4)

- [ ] **Applications** page loads in **Kanban** view by default; switch to **Table**.
- [ ] Filters: job, stage, assigned-to, tag, min score, min rating — apply each and
      confirm the list narrows correctly (or shows "No applications match these filters").
- [ ] In Kanban, use a card's stage dropdown to move it — it re-renders in the new column.
- [ ] Click a candidate row/card → lands on **Candidate detail**.
- [ ] **Resume viewer**: the uploaded PDF previews inline; "Open / download" opens a
      signed URL in a new tab.
- [ ] **Scoring panel** (admin/recruiter only): change stage, assign to a staff member,
      set a numeric score + notes, click **Save score**. Click **Quick rating** stars —
      confirm clicking the same star again clears the rating.
- [ ] Add and remove **tags**.
- [ ] As `interviewer` viewing a candidate they're *not* assigned to interview: candidates
      list should simply not show it (RLS-filtered) — confirm by comparing what an
      `interviewer` sees vs. `admin`.
- [ ] As `interviewer` viewing a candidate they *are* assigned to: they see a read-only
      "Pipeline status" box instead of the editable scoring panel, and no Notes thread.
- [ ] **HR manual upload** (**+ Add candidate**, admin/recruiter only): pick a job, fill
      candidate info, attach a resume, submit → lands on the new candidate's page.
- [ ] Manual upload **duplicate detection**: enter an email (or phone) that already exists
      as a candidate — a warning banner appears before submitting; submitting updates the
      existing candidate and adds a new application rather than erroring.

---

## 5. Collaboration (Phase 5)

- [ ] **Notes**: post a note on a candidate. Type `@` and a teammate's name — an
      autocomplete dropdown appears; pick one, send. Confirm the mentioned user gets a
      **notification** (bell icon, top right) linking back to this application.
- [ ] **Notifications**: the unread badge count is correct; clicking a notification marks
      it read and navigates to the right candidate; "Mark all read" clears the badge.
- [ ] Reassigning an application's "Assigned to" (§4) also fires an **assignment**
      notification to the new assignee (unless you assigned yourself).
- [ ] **Saved filters**: set some filters on the Applications page, click **+ Save
      filter**, name it. It appears as a chip below the filter row — click it to reapply
      those filters instantly; click **×** to delete it.
- [ ] Confirm saved filters are **per-user** — a different logged-in account doesn't see
      your saved filters.

---

## 6. Chat (spec update)

- [ ] From a candidate's `/status/:token` page (no login), send a message — confirm it's
      **left-aligned** there and **right-aligned** (as "mine") for HR on the same thread
      when viewed from Candidate Detail's "Chat with candidate" panel, and vice versa.
- [ ] Confirm a new candidate message creates a `chat_message` notification for the
      assigned staff member (none, if unassigned).
- [ ] Confirm chat updates without a full page reload within ~15s (both sides poll).
- [ ] As `interviewer`: chat should be **read-only or hidden** — the write policy is
      admin/recruiter only. Confirm an interviewer viewing candidate detail doesn't see a
      chat box they can post from (only admin/recruiter render `ChatThread` in the current
      UI, so this should simply not appear for them).

---

## 7. Interviews (Phase 6)

- [ ] On a candidate's application, **+ Schedule** an interview: date/time, interviewer
      (pick a staff member), mode = External, a link, submit.
- [ ] The interview card appears with status **Scheduled**.
- [ ] As `admin`/`recruiter`, change its status to **Completed** and add feedback text —
      auto-saves.
- [ ] Sign in as the **assigned interviewer** — go to `/dashboard/interviews`. Confirm
      they see *only* interviews assigned to them (not every interview in the system).
- [ ] As that interviewer, edit the status/feedback inline from the Interviews overview —
      it should succeed (this exercises the Phase 6 RLS fix that lets an interviewer
      update their *own* interview rows).
- [ ] Still as that interviewer, try (via browser dev tools / API, if you want to go this
      far) updating an interview belonging to someone else, or changing
      `interviewer_id`/`application_id` on their own interview — both should be rejected
      (RLS policy + the Phase 9 immutability trigger).
- [ ] As `admin`/`recruiter`, `/dashboard/interviews` shows *every* interview with the
      interviewer's name.

---

## 8. Calendar & to-dos (spec update)

- [ ] `/dashboard/calendar`: the scheduled interview from §7 appears as an orange chip on
      its date.
- [ ] Add a **to-do** (title + optional due date) in the sidebar to-do widget — it appears
      on the calendar as a blue chip on its due date, and also in the compact widget on
      the **Dashboard home** page.
- [ ] Click a day with items — a detail panel below the grid lists them, with the
      interview linking to the candidate.
- [ ] Check off a to-do (anywhere it's rendered) — it shows struck-through; delete it.
- [ ] Confirm to-dos are **strictly personal** — a second account doesn't see the first
      account's to-dos anywhere.
- [ ] Use the month **←/→/Today** controls.

---

## 9. Bulk actions & email triggers (Phase 7)

In the Applications **Table** view (admin/recruiter):

- [ ] Select 2+ rows via checkboxes — a bulk action bar appears.
- [ ] **Move to stage… → Apply** — all selected rows update; if `RESEND_API_KEY` is set
      and that stage is enabled in Settings (see below), each candidate gets an email.
- [ ] **Reject with email…** — a modal opens with an editable subject/body template
      (`{{candidate_name}}`, `{{job_title}}` placeholders). Send it: selected applications
      move to `Rejected` and (with email configured) each candidate receives the message.
- [ ] **Settings → Stage-change emails**: toggle a stage on, then move an application into
      that stage from anywhere (kanban, candidate detail, bulk) — confirm an email sends;
      toggle it off and confirm it doesn't.
- [ ] Check `email_log` (Supabase table editor) after any of the above — a row should
      exist per email actually sent.
- [ ] Without `RESEND_API_KEY` configured, confirm bulk-reject and stage-change actions
      still complete (the application still moves stage) — email sending fails
      gracefully rather than blocking the action.

---

## 10. Candidate comparison, offer letters, activity log (Phase 9)

- [ ] Select 2+ applications in the Applications table → **Compare** link appears →
      opens `/dashboard/applications/compare?ids=...` with side-by-side scorecards
      (stage, score, rating, notes, tags, assignee).
- [ ] On a candidate's page, **Generate offer letter**: fill company/start date/salary/
      signer/terms, **Download PDF** — a PDF downloads with those details filled in
      (open it and check the placeholder company name defaults to "Your Company" if left
      blank).
- [ ] Confirm an **Activity** entry appears for: stage changes, score/rating/tag edits,
      assignment, scheduling an interview, generating an offer letter, and (for a public
      submission) "submitted this application" with actor **System**.
- [ ] Activity log is visible to admin/recruiter only — confirm it doesn't render for an
      `interviewer`.

---

## 11. Reporting (Phase 8)

At `/dashboard/reports` (admin/recruiter):

- [ ] **Pipeline funnel**: pick a job with several applications across different stages —
      bar lengths and conversion percentages look sane (each stage's % is relative to the
      previous stage's count).
- [ ] **Time-in-stage flags**: lower the "stuck for N+ days" threshold to something small
      (e.g. 0) — applications that haven't moved recently should appear; raise it back up
      and they disappear.
- [ ] **Source tracking**: counts split correctly between "Public application" and "HR
      upload", bucketed into hired/in-progress/rejected.

---

## 12. Security spot-checks (Section 8 + Phase 9 audit)

These are worth checking by hand, not just trusting the code:

- [ ] Open the app **signed out** and try to directly query a protected table via the
      browser console using `fetch` against the Supabase REST endpoint with just the
      anon key (no session) — e.g. `candidates`, `applications`, `notes`. All should come
      back empty (RLS default-deny), not error — that's expected and correct.
- [ ] Confirm resume files are **not** reachable via a raw public URL (only via the signed
      URL the app generates, which expires).
- [ ] Confirm `/status/:token` for a random/garbage UUID shows "We couldn't find that
      application" rather than leaking anything.
- [ ] Submit 6 applications rapidly with the same email to the same public apply page —
      the 6th+ should be rejected with a rate-limit message (Edge Function's per-email cap).

---

## Known gaps to keep in mind while testing

- **Email requires `RESEND_API_KEY`** — set it via `supabase secrets set` or several
  flows above will silently no-op (by design) rather than fail loudly.
- **Job auto-close on `expires_at`** isn't implemented — an expired-but-still-`open` job
  stays publicly browsable (the apply *submission* is still blocked server-side).
- **Rate limiting is per-email only**, not per-IP — a determined abuser rotating emails
  isn't stopped by this alone.
- File-upload steps above can't be automated by an AI browser session (native OS file
  dialogs) — they were verified structurally (form renders, validates, calls the right
  functions) but the actual upload→parse→submit round trip is yours to click through.
