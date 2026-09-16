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

-- =========================================================================
-- Row-Level Security (RLS)
-- see hr-interview-portal-spec.md Section 4 "Row-Level Security (RLS)"
-- =========================================================================

alter table users enable row level security;
alter table jobs enable row level security;
alter table candidates enable row level security;
alter table applications enable row level security;
alter table interviews enable row level security;
alter table notes enable row level security;
alter table notifications enable row level security;
alter table saved_filters enable row level security;
alter table activity_log enable row level security;
alter table email_log enable row level security;

-- Helper functions (security definer: owned by the migration role, so they
-- read `users` directly without recursing into its own RLS policies).

create or replace function public.current_staff_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id from users where auth_id = auth.uid();
$$;

create or replace function public.current_staff_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from users where auth_id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from users where auth_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_admin_or_recruiter()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from users
    where auth_id = auth.uid() and role in ('admin', 'recruiter')
  );
$$;

-- True when the current authenticated user is the interviewer assigned to
-- at least one interview logged against this application.
create or replace function public.is_interviewer_for_application(app_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from interviews i
    join users u on u.id = i.interviewer_id
    where i.application_id = app_id and u.auth_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------
-- users
-- Every authenticated HR user can see the staff directory (needed for
-- @mentions and assignment pickers). A user can create their own row on
-- first login and edit their own profile; only admins can edit others.
-- (Not explicitly specified in Section 4 — a reasonable, minimal
-- interpretation to support the Phase 1 login/first-user-sync flow.)
-- ---------------------------------------------------------------------

create policy "users_select_authenticated"
  on users for select
  to authenticated
  using (true);

create policy "users_insert_self"
  on users for insert
  to authenticated
  with check (auth_id = auth.uid());

create policy "users_update_self_or_admin"
  on users for update
  to authenticated
  using (auth_id = auth.uid() or is_admin())
  with check (auth_id = auth.uid() or is_admin());

-- ---------------------------------------------------------------------
-- jobs
-- Public (including anonymous) may read only open jobs. Admin/recruiter
-- can read and write everything.
-- ---------------------------------------------------------------------

create policy "jobs_public_read_open"
  on jobs for select
  to anon, authenticated
  using (status = 'open');

create policy "jobs_staff_read_all"
  on jobs for select
  to authenticated
  using (is_admin_or_recruiter());

create policy "jobs_staff_insert"
  on jobs for insert
  to authenticated
  with check (is_admin_or_recruiter());

create policy "jobs_staff_update"
  on jobs for update
  to authenticated
  using (is_admin_or_recruiter())
  with check (is_admin_or_recruiter());

create policy "jobs_staff_delete"
  on jobs for delete
  to authenticated
  using (is_admin_or_recruiter());

-- ---------------------------------------------------------------------
-- candidates
-- No insert policy for anon/authenticated: public application intake
-- must go through a validated server-side path (Edge Function using the
-- service role key, which bypasses RLS entirely) — see Section 8.
-- Staff can insert directly for the HR manual-upload flow (Phase 4).
-- ---------------------------------------------------------------------

create policy "candidates_staff_select"
  on candidates for select
  to authenticated
  using (is_admin_or_recruiter());

create policy "candidates_interviewer_select"
  on candidates for select
  to authenticated
  using (
    exists (
      select 1 from applications a
      where a.candidate_id = candidates.id
        and is_interviewer_for_application(a.id)
    )
  );

create policy "candidates_staff_insert"
  on candidates for insert
  to authenticated
  with check (is_admin_or_recruiter());

create policy "candidates_staff_update"
  on candidates for update
  to authenticated
  using (is_admin_or_recruiter())
  with check (is_admin_or_recruiter());

create policy "candidates_staff_delete"
  on candidates for delete
  to authenticated
  using (is_admin_or_recruiter());

-- ---------------------------------------------------------------------
-- applications
-- Same public-insert restriction as candidates. Interviewers get
-- read-only access to applications they're assigned to interview.
-- ---------------------------------------------------------------------

create policy "applications_staff_select"
  on applications for select
  to authenticated
  using (is_admin_or_recruiter());

create policy "applications_interviewer_select"
  on applications for select
  to authenticated
  using (is_interviewer_for_application(id));

create policy "applications_staff_insert"
  on applications for insert
  to authenticated
  with check (is_admin_or_recruiter());

create policy "applications_staff_update"
  on applications for update
  to authenticated
  using (is_admin_or_recruiter())
  with check (is_admin_or_recruiter());

create policy "applications_staff_delete"
  on applications for delete
  to authenticated
  using (is_admin_or_recruiter());

-- ---------------------------------------------------------------------
-- interviews
-- Admin/recruiter manage everything. The assigned interviewer gets
-- read-only access to their own interviews.
-- ---------------------------------------------------------------------

create policy "interviews_staff_all"
  on interviews for all
  to authenticated
  using (is_admin_or_recruiter())
  with check (is_admin_or_recruiter());

create policy "interviews_interviewer_select"
  on interviews for select
  to authenticated
  using (interviewer_id = current_staff_id());

-- ---------------------------------------------------------------------
-- notes — admin/recruiter only, per Section 4.
-- ---------------------------------------------------------------------

create policy "notes_staff_all"
  on notes for all
  to authenticated
  using (is_admin_or_recruiter())
  with check (is_admin_or_recruiter());

-- ---------------------------------------------------------------------
-- notifications
-- Section 4 groups this with the admin/recruiter-only tables, but
-- notifications are inherently per-recipient (mentions/assignments) —
-- each user must be able to read and mark their own as read regardless
-- of role, or the in-app notification feature (Section 6, Phase 5)
-- cannot work. Deviation flagged for review.
-- ---------------------------------------------------------------------

create policy "notifications_own_select"
  on notifications for select
  to authenticated
  using (user_id = current_staff_id());

create policy "notifications_own_update"
  on notifications for update
  to authenticated
  using (user_id = current_staff_id())
  with check (user_id = current_staff_id());

create policy "notifications_staff_insert"
  on notifications for insert
  to authenticated
  with check (is_admin_or_recruiter());

-- ---------------------------------------------------------------------
-- saved_filters
-- Section 4 groups this with the admin/recruiter-only tables, but these
-- are personal presets per Section 6 ("saved filter presets per HR
-- user") — scoped to the owning user, not role. Deviation flagged for
-- review, same as notifications above.
-- ---------------------------------------------------------------------

create policy "saved_filters_own"
  on saved_filters for all
  to authenticated
  using (user_id = current_staff_id())
  with check (user_id = current_staff_id());

-- ---------------------------------------------------------------------
-- activity_log — admin/recruiter can read and append; immutable
-- otherwise (no update/delete policy for anyone but the table owner).
-- ---------------------------------------------------------------------

create policy "activity_log_staff_select"
  on activity_log for select
  to authenticated
  using (is_admin_or_recruiter());

create policy "activity_log_staff_insert"
  on activity_log for insert
  to authenticated
  with check (is_admin_or_recruiter());

-- ---------------------------------------------------------------------
-- email_log — admin/recruiter only. Automated sends from Edge Functions
-- use the service role key and bypass RLS.
-- ---------------------------------------------------------------------

create policy "email_log_staff_select"
  on email_log for select
  to authenticated
  using (is_admin_or_recruiter());

create policy "email_log_staff_insert"
  on email_log for insert
  to authenticated
  with check (is_admin_or_recruiter());
