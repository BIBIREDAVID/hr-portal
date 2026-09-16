# HR Interview Portal — Build Specification

**Purpose of this document:** This is a complete, self-contained build spec for an internal HR Interview Portal. It is written to be handed to Claude (or any developer) as the single source of truth for building the project from scratch, end to end. Follow the phases in order — each phase produces a working, testable increment.

---

## 1. Project Overview

A web application for a **single company's internal HR team** to:
- Receive resumes via a public job application page and via manual HR upload
- Organize candidates through a hiring pipeline (kanban-style stages)
- Score and annotate candidates manually
- Log interviews (scheduling + feedback), without requiring interviews to happen inside the portal (external links like Zoom/Meet are fine)
- Give candidates a no-login way to check their application status
- Give HR reporting on pipeline health

This is **not** multi-tenant SaaS — it serves one organization's HR team only.

---

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite |
| Backend / DB | Postgres via **Supabase** (Auth + Database + Storage + auto-generated API in one) |
| ORM / query layer | Supabase JS client (`@supabase/supabase-js`); raw SQL for migrations |
| Hosting | Vercel (frontend), Supabase (backend/DB/storage) |
| Email | Resend or Postmark (transactional email for acknowledgments, stage changes, rejections) |
| Resume parsing | `pdf-parse` (PDF) + `mammoth` (docx) for text extraction; simple regex/keyword extraction for name/email/phone — no AI required for v1 |
| PDF generation (offer letters) | `@react-pdf/renderer` or `pdf-lib` |

**Why Supabase over plain Postgres:** it bundles Auth, Storage (for resume files), and a Postgres database with row-level security, so you avoid standing up a separate backend API server for straightforward CRUD, while still keeping everything in real SQL.

---

## 3. Environment Variables

Create a `.env` file (never commit this):

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # server-side only, never expose to client
RESEND_API_KEY=                  # or POSTMARK_API_KEY
EMAIL_FROM_ADDRESS=hr@yourcompany.com
```

---

## 4. Database Schema (Postgres / Supabase)

Run as a single migration (`supabase/migrations/0001_init.sql`).

```sql
-- Enable UUID generation
create extension if not exists "pgcrypto";

-- HR staff accounts
create table users (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid unique references auth.users(id) on delete cascade, -- link to Supabase Auth
  email text unique not null,
  name text not null,
  role text check (role in ('admin','recruiter','interviewer')) default 'recruiter',
  created_at timestamptz default now()
);

-- Job postings
create table jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  department text,
  description text,
  requirements text,
  custom_fields jsonb default '[]',       -- e.g. [{"label":"Portfolio link","type":"url","required":false}]
  status text check (status in ('draft','open','closed')) default 'draft',
  expires_at timestamptz,
  -- job page builder (public-facing page, not just a bare form)
  headline text,                          -- e.g. "Be our technical pioneer"
  hero_image_url text,
  benefits jsonb default '[]',            -- e.g. [{"label":"Health insurance"}, ...]
  tasks jsonb default '[]',               -- e.g. [{"label":"UI/UX design (40%)"}, ...]
  requirements_list jsonb default '[]',   -- structured requirement bullets, separate from free-text `requirements`
  -- location
  locations text[] default '{}',          -- multi-location, e.g. {'Lagos','Remote'}
  work_mode text check (work_mode in ('onsite','remote','hybrid')) default 'onsite',
  created_by uuid references users(id),
  created_at timestamptz default now()
);

-- Candidates (a person; can apply to multiple jobs)
create table candidates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  resume_url text not null,
  resume_parsed jsonb,                    -- extracted text/fields from parsing
  source text check (source in ('public_application','hr_upload')) not null,
  portfolio_url text,
  status_token text unique default gen_random_uuid(), -- for no-login status page
  created_at timestamptz default now()
);
create index idx_candidates_email_phone on candidates(email, phone);

-- Applications (candidate <-> job join, with pipeline state)
create table applications (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references candidates(id) on delete cascade,
  job_id uuid references jobs(id) on delete cascade,
  custom_field_responses jsonb default '{}',
  stage text check (stage in ('new','screening','shortlisted','interview','offer','hired','rejected')) default 'new',
  stage_updated_at timestamptz default now(),
  score numeric(3,1),
  score_notes text,
  rating smallint check (rating between 1 and 5), -- quick star rating, sits alongside `score`
  assigned_to uuid references users(id),
  tags text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (candidate_id, job_id)
);
create index idx_applications_stage_job on applications(job_id, stage);

-- Interviews (logged, not hosted in-portal)
create table interviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications(id) on delete cascade,
  scheduled_at timestamptz,
  mode text check (mode in ('in_portal','external')) default 'external',
  external_link text,
  interviewer_id uuid references users(id),
  status text check (status in ('scheduled','completed','cancelled','no_show')) default 'scheduled',
  feedback text,
  created_at timestamptz default now()
);

-- Informal comments thread per application
create table notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications(id) on delete cascade,
  author_id uuid references users(id),
  body text not null,
  mentioned_user_ids uuid[],
  created_at timestamptz default now()
);

-- In-app notifications
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  type text not null,             -- 'mention' | 'assignment'
  reference_id uuid,
  message text,
  read boolean default false,
  created_at timestamptz default now()
);

-- HR-saved filter presets
create table saved_filters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  name text not null,
  filter_config jsonb not null,
  created_at timestamptz default now()
);

-- Audit trail
create table activity_log (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications(id) on delete cascade,
  actor_id uuid references users(id),
  action text not null,
  created_at timestamptz default now()
);

-- Email send log
create table email_log (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references candidates(id) on delete cascade,
  application_id uuid references applications(id) on delete cascade,
  type text not null,             -- 'acknowledgment' | 'stage_change' | 'rejection' | 'offer'
  sent_at timestamptz default now()
);

-- In-app chat between HR and a candidate (per application)
create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications(id) on delete cascade,
  sender_type text check (sender_type in ('hr','candidate')) not null,
  sender_user_id uuid references users(id),  -- set when sender_type = 'hr', null for candidate
  body text not null,
  read_by_hr boolean default false,
  read_by_candidate boolean default false,
  created_at timestamptz default now()
);
create index idx_chat_messages_application on chat_messages(application_id, created_at);

-- HR personal to-do list (separate from candidate/application data)
create table hr_todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  title text not null,
  due_at timestamptz,
  completed boolean default false,
  created_at timestamptz default now()
);

-- Trigger: keep stage_updated_at fresh when stage changes
create or replace function update_stage_timestamp()
returns trigger as $$
begin
  if new.stage is distinct from old.stage then
    new.stage_updated_at = now();
  end if;
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_applications_stage
before update on applications
for each row execute function update_stage_timestamp();
```

### Row-Level Security (RLS)

Enable RLS on all tables. Core rules:

- `candidates` + `applications`: **insert** allowed for anonymous/public role only through the public application flow (via a Postgres function or Supabase Edge Function that validates input server-side — do not allow raw public insert to avoid spam/abuse). All **read/update/delete** restricted to authenticated HR users.
- All other tables (`jobs` write, `interviews`, `notes`, `notifications`, `saved_filters`, `activity_log`, `email_log`, `hr_todos`): restricted to authenticated users with role `admin` or `recruiter`; `interviewer` role gets read-only access scoped to applications where they are the assigned `interviewer_id` on an interview.
- `jobs` **read** (status = `open` only) is public, for the public application page to list/show open jobs.
- `chat_messages`: authenticated HR users read/write messages on applications they can access (same scoping as `applications`). Candidates read/write only their own application's messages, authenticated via `status_token` rather than a full account — validate this through an Edge Function, never a direct client insert with the token as a bare filter (a leaked token shouldn't grant write access without server-side validation).
- `hr_todos`: strictly personal — each user reads/writes only rows where `user_id` matches their own `users.id`.

---

## 5. Application Structure

```
hr-interview-portal/
├── src/
│   ├── pages/
│   │   ├── apply/[jobId].tsx          # public application form
│   │   ├── status/[token].tsx         # public candidate status page
│   │   ├── login.tsx
│   │   ├── dashboard/
│   │   │   ├── jobs/                  # job CRUD + job page builder
│   │   │   ├── applications/          # kanban + table views
│   │   │   ├── candidates/[id].tsx    # candidate detail (resume, score, rating, notes, chat, interviews)
│   │   │   ├── calendar/              # calendar view (interviews + to-dos)
│   │   │   ├── reports/               # funnel, time-in-stage, source tracking
│   │   │   └── settings/              # users, roles
│   ├── components/
│   │   ├── ResumeViewer.tsx
│   │   ├── ScoringPanel.tsx           # numeric score + star rating
│   │   ├── KanbanBoard.tsx
│   │   ├── NotesThread.tsx
│   │   ├── ChatThread.tsx             # in-app HR <-> candidate chat
│   │   ├── CandidateNav.tsx           # prev/next candidate navigation
│   │   ├── CalendarView.tsx           # month view, interviews + to-dos
│   │   ├── TodoList.tsx               # HR personal to-do widget
│   │   ├── JobPageBuilder.tsx         # headline/hero image/benefits/tasks/requirements editor
│   │   ├── CustomFieldForm.tsx        # renders job.custom_fields dynamically
│   │   └── ...
│   ├── lib/
│   │   ├── supabaseClient.ts
│   │   ├── resumeParser.ts
│   │   └── email.ts
│   └── App.tsx
├── supabase/
│   ├── migrations/0001_init.sql
│   └── functions/                     # Edge Functions (public apply, email sends)
├── .env
└── package.json
```

---

## 6. Feature List (Full Scope)

### Candidate experience
- Public job listing + application form (`/apply/:jobId`), dynamic fields from `jobs.custom_fields`
- No-login status page (`/status/:token`) showing current stage
- Auto-acknowledgment email on submission
- Stage-change email notifications (optional per stage)
- Basic resume parsing to pre-fill name/email/phone on the form

### HR pipeline management
- Kanban board and table view of applications, filterable by stage/score/rating/tags/job
- Resume viewer (inline PDF/doc preview) next to scoring panel
- Manual scoring: numeric score + notes, plus a quick 1–5 star `rating` for fast triage
- Manual resume upload by HR (candidate not required to apply publicly)
- Duplicate candidate detection (by email/phone) at upload/apply time
- Bulk stage changes + bulk reject with templated email
- Notes/comments thread per candidate, with @mentions
- In-app chat with the candidate, scoped per application (candidate accesses it via their status-page token, no account needed)
- Prev/next candidate navigation inside the candidate detail view, so HR can page through a shortlist without returning to the list each time
- In-app notifications for mentions and assignments
- Saved filter presets per HR user
- Activity log per application (audit trail)
- A calendar view (month grid) showing scheduled interviews and HR to-dos together, not just a flat interview list
- Personal HR to-do list (title, due date, completed), separate from candidate/application data

### Interviews
- Schedule interviews tied to an application
- Mode: `in_portal` (reserved for future) or `external` (link to Zoom/Meet/etc.)
- Interviewer assignment, feedback capture, status tracking
- Interviewer role sees only their assigned interviews/candidates

### Reporting
- Pipeline funnel per job (counts + conversion rate per stage)
- Time-in-stage flags (candidates stuck beyond a threshold)
- Source tracking (`public_application` vs `hr_upload` outcomes over time)

### Job management
- Job CRUD with custom application fields per job
- Draft/open/closed status, optional auto-close via `expires_at`
- Multi-location support (a job can list several cities) plus a remote/hybrid/onsite `work_mode`
- Job page builder: headline, hero image, and structured Benefits / Tasks / Requirements sections (each rendered as its own block with its own "Apply now" CTA on the public page) — replaces a bare text-field form with an actual designed page, closer to what candidates expect from a real careers site

### Later / polish (build after core v1 is stable)
- Candidate comparison view (side-by-side scorecards for finalists)
- Offer letter generation (PDF from templates)

---

## 7. Build Phases

Build and test each phase before moving to the next.

**Phase 1 — Foundation**
1. Set up Supabase project, run the migration in Section 4, enable RLS policies
2. Set up Vite + React app, connect Supabase client
3. Auth: login page, `users` table synced to `auth.users`, role-based route guards

**Phase 2 — Jobs**
4. Job CRUD UI (admin/recruiter only): create/edit/list jobs, define `custom_fields`, set status, `expires_at`, `locations` (multi-select/tag input), and `work_mode`
4a. Job page builder: headline, hero image upload, and repeatable Benefits/Tasks/Requirements block editors (`benefits`/`tasks`/`requirements_list`), with a live mobile/desktop preview of the resulting public job page

**Phase 3 — Public intake**
5. Public `/apply/:jobId` page: render the job page built in Phase 2a (headline, hero image, Benefits/Tasks/Requirements sections) with the application form (dynamic fields from `custom_fields`), resume upload to Supabase Storage, duplicate check against `candidates`, resume parsing to pre-fill fields, creates `candidates` + `applications` rows
6. Auto-acknowledgment email on successful submission
7. Public `/status/:token` page showing stage (no auth), with an embedded chat panel (Phase 5) so the candidate can message HR from the same page

**Phase 4 — HR dashboard core**
8. Applications list: table + kanban views, filters (stage/job/score/rating/tags/assigned_to)
9. Candidate detail page: resume viewer, scoring panel (numeric score + star rating), stage changer, tags, prev/next candidate navigation
10. HR manual upload flow (create candidate + application directly)

**Phase 5 — Collaboration**
11. Notes thread with @mentions
12. In-app chat: `ChatThread` component on the candidate detail page (HR side) and on the `/status/:token` page (candidate side), backed by `chat_messages`, validated through an Edge Function on the candidate side per Section 4/8
13. Notifications (mentions, assignments, and new chat messages)
14. Saved filters

**Phase 6 — Interviews & calendar**
15. Interview scheduling UI tied to an application, external link field, interviewer assignment
16. Feedback capture + status updates
17. Interviewer-scoped view (restricted role)
18. Calendar view (`CalendarView`): month grid pulling from `interviews.scheduled_at` and `hr_todos.due_at` together
19. HR to-do list (`TodoList`): add/complete/due-date, personal to each user, surfaced on the calendar and as a standalone widget

**Phase 7 — Bulk actions & emails**
20. Bulk stage change, bulk reject with templated rejection email
21. Stage-change email triggers (configurable per stage)

**Phase 8 — Reporting**
22. Pipeline funnel view per job
23. Time-in-stage flagging
24. Source tracking dashboard

**Phase 9 — Polish**
25. Candidate comparison view
26. Offer letter PDF generation
27. Activity log surfaced in UI, final audit of RLS policies

---

## 8. Security Checklist

- [ ] RLS enabled on every table, no table left with default-open policies
- [ ] Public insert to `candidates`/`applications` goes through a validated server-side path (Edge Function), not direct client insert, to prevent spam/abuse
- [ ] `SUPABASE_SERVICE_ROLE_KEY` only used server-side (Edge Functions), never shipped to the client bundle
- [ ] Resume files stored in a private Storage bucket; served via signed URLs, not public URLs
- [ ] Status page token (`status_token`) is a UUID, not guessable/sequential
- [ ] Rate-limit the public application endpoint
- [ ] Validate file type/size on resume upload (PDF/docx only, reasonable size cap e.g. 5MB)

---

## 9. Notes for Whoever Builds This

- Scoring is **manual only** for v1 — no AI scoring. Keep `score` as a simple numeric field with `score_notes` for context; `rating` is a separate, quicker 1–5 star field for fast triage — don't derive one from the other, they can disagree (e.g. a low-effort 5-star gut reaction before a properly scored review).
- Interviews are explicitly **not** required to happen inside the portal — `external_link` is the primary path; `in_portal` mode exists in the schema for future extension only, do not build video infrastructure for v1.
- In-app chat is a lightweight messaging channel, not a replacement for the interview itself — it's for logistics/questions before or after an interview, not a video/call feature.
- This is single-org — do not add an `organizations`/tenant table unless scope changes; keep it simple.
- Resume parsing is a nice-to-have for pre-filling forms, not a source of truth — HR/candidate-entered data always wins over parsed data.
- Multi-location (`jobs.locations`) is a simple text array for v1 — don't build a separate offices/locations table unless the org later needs per-location details (address, timezone) beyond a label.
