# HR Interview Portal

An internal tool for a single company's HR team to receive resumes, run candidates through a
hiring pipeline, log interviews, and report on pipeline health. Candidates get a no-login status
page; HR gets a dashboard for jobs, applications, scoring, notes, and interviews.

## Stack

- Frontend: React + Vite, `react-router-dom`
- Backend/DB: Postgres via Supabase (Auth + Database + Storage), business logic in Supabase
  Edge Functions (`supabase/functions`: `apply`, `chat`, `invite-staff`, `scheduling`, `send-email`)
- Client: `@supabase/supabase-js`
- Email: Resend
- Hosting: Vercel (frontend)

## Features

- **Public job board & application** (`/apply`, `/apply/:jobId`) — resume upload with
  autofill (name/email/phone), custom per-job fields, duplicate-application detection.
- **No-login candidate status** (`/status/:token`) — status lookup plus a chat thread with HR.
- **Job page builder** — headline, hero image, benefits/tasks/requirements, work mode,
  multi-location, live desktop/mobile preview.
- **Pipeline management** (`/dashboard/applications`) — Kanban and Table views, filters,
  saved filters, bulk stage moves with email triggers.
- **Candidate detail & scoring** — resume viewer, scoring panel, quick-rating stars, tags,
  notes with @mentions, chat with the candidate.
- **Interviews & scheduling** (`/dashboard/interviews`, `/dashboard/calendar`) — interview
  logging plus candidate self-scheduling via the `scheduling` Edge Function.
- **Reporting** (`/dashboard/reports`) — pipeline health.
- **Staff admin & settings** (`/dashboard/settings/staff`, `/settings/email-triggers`) —
  invite staff, configure automated emails.
- **Role-based access** — `admin` / `recruiter` / `interviewer`, enforced by route guards
  and Postgres RLS (interviewers see only candidates they're assigned to, read-only).

Full build spec (schema, phases, security checklist): [hr-interview-portal-spec.md](./hr-interview-portal-spec.md)

## Setup

1. **Environment variables** — copy `.env.example` to `.env` and fill in the values:

   ```bash
   cp .env.example .env
   ```

   - `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — from your Supabase project settings
   - `SUPABASE_SERVICE_ROLE_KEY` — server-side only (Edge Functions), never expose to the client
   - `RESEND_API_KEY` (or `POSTMARK_API_KEY`) and `EMAIL_FROM_ADDRESS` — for transactional email

2. **Run the Supabase migrations** — applies all schema changes in `supabase/migrations/`
   (`0001_init.sql` through `0008_scorecards_scheduling_source.sql`):

   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```

   (or paste each migration file into the Supabase SQL editor, in order)

3. **Install dependencies:**

   ```bash
   npm install
   ```

4. **Run the dev server:**

   ```bash
   npm run dev
   ```

5. **Log in.** There's no self-serve signup. The **first person ever to sign in becomes
   `admin`**; everyone after defaults to `recruiter` (promote to `interviewer` via SQL —
   see [TESTING.md](./TESTING.md) §0 for the full walkthrough of setting up all three
   roles and testing every feature end to end).

## Project structure

- `src/pages/` — `apply/` (public application), `status/` (candidate status + chat),
  `dashboard/` (jobs, applications, candidates, interviews, calendar, reports, settings),
  `login.jsx`, `PrivacyPage.jsx`
- `src/components/` — shared UI (sidebar, filters, scoring panel, notifications, etc.)
- `src/lib/` — `AuthContext.jsx` (auth + role assignment), Supabase client, helpers
- `supabase/migrations/` — schema, one file per phase (0001–0008)
- `supabase/functions/` — Edge Functions: `apply`, `chat`, `invite-staff`, `scheduling`, `send-email`

See [hr-interview-portal-spec.md](./hr-interview-portal-spec.md) for the full schema and
build spec.
