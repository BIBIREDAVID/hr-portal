-- =========================================================================
-- Email-verified applications for returning candidates.
--
-- The public apply form has no login, so an email address on its own
-- proves nothing. Before this, a submission whose email matched an
-- existing candidate immediately (a) created an application in that
-- candidate's name, (b) replaced their name/resume, and (c) returned
-- their status_token — letting anyone who knew an applicant's email
-- open their status page, read their HR chat and book interview slots.
--
-- Now such a submission is parked here and nothing else changes. The
-- `apply` function emails a confirmation link to the address ON FILE;
-- only the `confirm-application` function, given that link's token,
-- creates the application and applies the submitted details.
-- Brand-new email addresses are unaffected (no one to impersonate).
-- =========================================================================

create table pending_applications (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references candidates(id) on delete cascade not null,
  job_id uuid references jobs(id) on delete cascade not null,
  name text not null,
  phone text,
  portfolio_url text,
  resume_url text not null,
  resume_parsed jsonb,
  custom_field_responses jsonb default '{}',
  source_detail text,
  token text unique not null default gen_random_uuid()::text,
  created_at timestamptz default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  confirmed_at timestamptz,
  application_id uuid references applications(id) on delete set null
);
create index idx_pending_applications_candidate on pending_applications(candidate_id, created_at);

-- Only the service-role Edge Functions read/write this table (the token
-- is a secret). HR can see what's pending, read-only.
alter table pending_applications enable row level security;

create policy "pending_applications_staff_select"
  on pending_applications for select
  to authenticated
  using (is_admin_or_recruiter());
