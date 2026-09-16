# HR Interview Portal

An internal tool for a single company's HR team to receive resumes, run candidates through a
hiring pipeline, log interviews, and report on pipeline health. Candidates get a no-login status
page; HR gets a dashboard for jobs, applications, scoring, notes, and interviews.

Full build spec (schema, phases, security checklist): [hr-interview-portal-spec.md](./hr-interview-portal-spec.md)

## Stack

- Frontend: React + Vite
- Backend/DB: Postgres via Supabase (Auth + Database + Storage)
- Client: `@supabase/supabase-js`

This repo currently contains only the project skeleton — no features are implemented yet.
Build order follows the phases in Section 7 of the spec.

## Setup

1. **Environment variables** — copy `.env.example` to `.env` and fill in the values:

   ```bash
   cp .env.example .env
   ```

   - `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — from your Supabase project settings
   - `SUPABASE_SERVICE_ROLE_KEY` — server-side only (Edge Functions), never expose to the client
   - `RESEND_API_KEY` (or `POSTMARK_API_KEY`) and `EMAIL_FROM_ADDRESS` — for transactional email

2. **Run the Supabase migration** — creates the schema described in Section 4 of the spec:

   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```

   (or paste the contents of `supabase/migrations/0001_init.sql` into the Supabase SQL editor)

3. **Install dependencies:**

   ```bash
   npm install
   ```

4. **Run the dev server:**

   ```bash
   npm run dev
   ```

## Project structure

See Section 5 of the spec for the intended layout under `src/pages`, `src/components`,
`src/lib`, and `supabase/`.
