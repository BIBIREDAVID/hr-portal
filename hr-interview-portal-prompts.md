# HR Interview Portal — Build Prompts

Use these with **Claude Code**, one phase at a time, in order. Each prompt assumes `hr-interview-portal-spec.md` is in the project root (or pasted into context) so Claude can reference the schema/structure/rules directly instead of you re-explaining them.

Run each prompt, review/test the output, commit, **then** move to the next prompt. Don't batch multiple phases into one prompt — the increments are sized so each one is independently testable.

---

### Setup prompt (run once, before Phase 1)

```
I'm building the HR Interview Portal described in hr-interview-portal-spec.md
(attached/in this repo). Read the whole spec before doing anything.

Set up the project skeleton:
- Vite + React app with the folder structure from Section 5 of the spec
- Install and configure the Supabase client (@supabase/supabase-js)
- Create a .env.example with the variables listed in Section 3 (no real values)
- Add a README.md summarizing what the project is, linking to the spec doc,
  and listing setup steps (env vars, running the Supabase migration, npm install, npm run dev)

Do not build any features yet — just the skeleton, tooling, and config.
```

---

### Phase 1 — Foundation (Auth + DB)

```
Following hr-interview-portal-spec.md, implement Phase 1: Foundation.

1. Create the Supabase migration file at supabase/migrations/0001_init.sql using
   the exact schema in Section 4 of the spec, including the RLS policies
   described there (public insert only through a validated path for candidates/
   applications, everything else restricted to authenticated HR roles, jobs
   readable publicly only when status = 'open').
2. Wire up src/lib/supabaseClient.ts using the env vars from Section 3.
3. Build a login page (email/password via Supabase Auth).
4. On first login, sync the Supabase Auth user into the `users` table if not
   already present (default role 'recruiter' unless it's the first user ever,
   who should become 'admin').
5. Add route guards so /dashboard/* routes require auth, and redirect
   unauthenticated users to /login.

Confirm RLS is enabled on every table before finishing — walk through Section 8
of the spec (Security Checklist) and flag anything not yet satisfied at this phase.
```

---

### Phase 2 — Jobs

```
Following hr-interview-portal-spec.md, implement Phase 2: Jobs.

Build the job posting CRUD under src/pages/dashboard/jobs/, restricted to
'admin' and 'recruiter' roles:
- List view of all jobs with status badges (draft/open/closed)
- Create/edit form including title, department, description, requirements,
  status, expires_at, a locations field (tag/multi-select input backed by
  jobs.locations text[]), a work_mode selector (onsite/remote/hybrid), and
  a custom_fields builder (add/remove fields with label, type, required —
  matching the jsonb shape in Section 4)
- Deleting a job should be blocked or require confirmation if applications
  already exist against it (don't cascade-delete candidate data silently)

Keep the custom_fields builder simple: a repeatable row UI (label, type
dropdown [text, textarea, number, url], required checkbox), stored as the
jsonb array shape shown in the schema.
```

---

### Phase 2a — Job page builder

```
Following hr-interview-portal-spec.md, implement Phase 2a: the job page
builder (JobPageBuilder component), as an additional tab/step on the job
create/edit flow from Phase 2.

Build an editor with:
- Headline text field (jobs.headline)
- Hero image upload (jobs.hero_image_url, uploaded to Supabase Storage)
- Three repeatable block editors — Benefits, Tasks, Requirements — each a
  simple add/remove list of short text items, stored as jsonb arrays
  (jobs.benefits, jobs.tasks, jobs.requirements_list)
- A live preview pane next to the editor (toggle Mobile/Desktop) rendering
  the actual public job page as it will appear: headline + hero image at
  top, then the three sections as distinct blocks, each with its own
  "Apply now" button linking to /apply/:jobId

This replaces a bare text form with an actual designed careers page —
the public /apply/:jobId page built in Phase 3 should render exactly what
this preview shows.
```

---

### Phase 3 — Public Intake

```
Following hr-interview-portal-spec.md, implement Phase 3: Public Intake.

1. Build the public application page at /apply/:jobId:
   - Fetch the job (must be status='open', else show "This position is no
     longer accepting applications")
   - Render the job page built in Phase 2a: headline, hero image, and the
     Benefits/Tasks/Requirements blocks, above the application form
   - Show the job's location(s) and work_mode near the title (e.g. "Lagos,
     Remote · Hybrid")
   - Standard form fields: name, email, phone, resume upload, portfolio_url (optional)
   - Dynamically render the job's custom_fields underneath
   - On resume upload, run basic parsing (Section 6) to pre-fill name/email/
     phone if extractable — let the candidate override anything
   - Before final submit, check for an existing candidate with the same
     email or phone; if found, show a non-blocking "we found a possible
     existing application" notice but still allow submission
   - Submit via a Supabase Edge Function (not a direct client insert) that
     validates input server-side, per the RLS notes in Section 4/8
   - On success, create the candidate + application rows and show a
     confirmation with a link to their status page (/status/:token)

2. Build the auto-acknowledgment email: triggered from the same Edge
   Function on successful submission, logged to email_log with type
   'acknowledgment'.

3. Build the public status page at /status/:token — no auth, looks up the
   candidate by status_token, shows their application(s) and current
   stage(s) in plain language (e.g. "Under Review", "Shortlisted",
   "Not moving forward this time"). Leave a placeholder section for the
   chat panel — it gets built in Phase 5.

Enforce the security checklist items relevant here: rate-limit the
submission endpoint, validate file type/size (PDF/docx, 5MB cap), store
resumes in a private bucket with signed URLs only.
```

---

### Phase 4 — HR Dashboard Core

```
Following hr-interview-portal-spec.md, implement Phase 4: HR Dashboard Core.

1. Applications list at src/pages/dashboard/applications/:
   - Table view and kanban view (toggle between them), kanban columns = stage
   - Filters: job, stage, score range, rating, tags, assigned_to
   - Show the star rating on each kanban card/table row alongside the
     numeric score
   - Clicking a candidate opens their detail page

2. Candidate detail page at src/pages/dashboard/candidates/[id].tsx:
   - Inline resume viewer (render the PDF/doc from its signed URL)
   - Scoring panel: numeric score input + score_notes textarea, plus a
     separate 1-5 star rating control (applications.rating) — these are
     two distinct fields, don't derive one from the other
   - Stage changer (dropdown or buttons through the stage list), updates
     stage and relies on the existing DB trigger to bump stage_updated_at
   - Tag editor (add/remove from applications.tags)
   - Prev/next candidate navigation (CandidateNav component): buttons to
     move to the previous/next candidate in the current filtered list
     without returning to the list view
   - Log every stage change and score update to activity_log

3. HR manual upload flow: a "Add candidate manually" action that creates
   a candidate (source='hr_upload') and application directly from the
   dashboard, reusing the same resume upload + duplicate-check logic
   built in Phase 3 where possible.
```

---

### Phase 5 — Collaboration

```
Following hr-interview-portal-spec.md, implement Phase 5: Collaboration.

1. Notes thread component (src/components/NotesThread.tsx) on the candidate
   detail page: chronological list of notes, add-note box supporting
   @mentions (autocomplete against the users table), stores
   mentioned_user_ids on the note.

2. In-app chat (ChatThread component), backed by chat_messages:
   - HR side: a chat panel on the candidate detail page, sender_type='hr',
     sender_user_id = the logged-in user
   - Candidate side: a chat panel on the /status/:token page (the
     placeholder left in Phase 3), sender_type='candidate'. Submissions
     from this page must go through a Supabase Edge Function that
     validates the status_token server-side before inserting — never let
     the client insert directly using the token as a bare filter
   - Mark messages read_by_hr / read_by_candidate appropriately when each
     side views the thread

3. Notifications: when a note mentions a user, a candidate is assigned to
   a user (assigned_to), or a new chat message arrives from a candidate,
   create a row in notifications. Add a notification bell in the
   dashboard header showing unread count, with a dropdown listing recent
   notifications and a mark-as-read action.

4. Saved filters: on the applications list, let users save their current
   filter combination as a named preset (saved_filters), and load/delete
   presets from a dropdown.
```

---

### Phase 6 — Interviews & Calendar

```
Following hr-interview-portal-spec.md, implement Phase 6: Interviews &
Calendar.

1. On the candidate detail page, add an Interviews section: schedule an
   interview (scheduled_at, interviewer, mode, external_link if mode=
   'external'), list past/upcoming interviews for that application.

2. Interview status updates (scheduled/completed/cancelled/no_show) and a
   feedback textarea, editable by the assigned interviewer or an admin/recruiter.

3. Build an interviewer-scoped view: when a user with role='interviewer'
   logs in, restrict their dashboard to only applications where they have
   an interview assigned — they should not see the full pipeline or other
   candidates' scores/notes.

4. Build a calendar page at src/pages/dashboard/calendar/ (CalendarView
   component): a month-grid view combining interviews.scheduled_at and
   hr_todos.due_at as items on their respective days. Clicking an
   interview item opens (or links to) that candidate's detail page;
   clicking a to-do lets you mark it complete inline.

5. Build a personal to-do list (TodoList component): add/complete/delete
   items in hr_todos, scoped to the logged-in user only. Surface it both
   as a standalone widget (e.g. dashboard sidebar) and as the to-do items
   shown on the calendar.

Do not build any in-portal video/meeting functionality — external_link is
the only mechanism for the interview itself, per Section 9 of the spec.
```

---

### Phase 7 — Bulk Actions & Emails

```
Following hr-interview-portal-spec.md, implement Phase 7: Bulk Actions & Emails.

1. On the applications table view, add multi-select checkboxes and bulk
   actions: bulk stage change, and bulk reject (sets stage='rejected' and
   sends a templated rejection email to each selected candidate, logged
   to email_log).

2. Add configurable stage-change emails: when an application's stage
   changes, optionally send a templated email to the candidate reflecting
   the new stage (make this toggleable per stage in a simple settings
   panel, off by default except for 'rejected').

Reuse the email sending logic from Phase 3's acknowledgment email rather
than duplicating it — centralize it in src/lib/email.ts.
```

---

### Phase 8 — Reporting

```
Following hr-interview-portal-spec.md, implement Phase 8: Reporting.

Build src/pages/dashboard/reports/ with three views:

1. Pipeline funnel: per job, show candidate counts at each stage and the
   conversion rate between consecutive stages (e.g. new -> screening ->
   shortlisted -> interview -> offer -> hired).

2. Time-in-stage: list applications where now() - stage_updated_at exceeds
   a configurable threshold (default 7 days), grouped by stage, so HR can
   spot stalled candidates.

3. Source tracking: compare public_application vs hr_upload — volume and,
   where available, how far each source's candidates progress through the
   pipeline (e.g. % reaching 'hired').

Keep these as read-only dashboards using straightforward aggregate SQL
queries (via Supabase) — no need for a separate analytics service.
```

---

### Phase 9 — Polish

```
Following hr-interview-portal-spec.md, implement Phase 9: Polish.

1. Candidate comparison view: pick 2-4 applications for the same job,
   show their scores, score_notes, tags, and interview feedback side by
   side.

2. Offer letter generation: a simple template (company name, candidate
   name, job title, placeholder for salary/start date) rendered to PDF
   from an application's data, downloadable from the candidate detail page.

3. Surface the activity_log in the UI as a timeline on the candidate
   detail page.

4. Final pass: go through Section 8 (Security Checklist) of the spec
   line by line and confirm every item is actually satisfied in the
   current codebase — report back anything still open.
```

---

## Tips for using these with Claude Code

- Keep `hr-interview-portal-spec.md` in the repo root so Claude Code can read it directly instead of you pasting schema details into every prompt.
- If Claude Code drifts from the schema (e.g. renames a column), correct it immediately rather than letting later phases build on the wrong foundation — the phases are cumulative.
- After Phase 1, Phase 3, and Phase 5's chat piece especially, actually test the RLS policies (try hitting the DB as an anonymous user, or with a fabricated status_token) before moving on — those are the phases where a mistake is a real security hole, not just a bug. Chat is a new attack surface: a candidate's status_token is the only thing standing between them and someone else's application thread, so it deserves its own explicit test pass.
