-- Structured interview scorecards: a job defines its criteria, each
-- interview records a rating per criterion.
alter table jobs add column if not exists scorecard_template jsonb default '[]';
alter table interviews add column if not exists scorecard jsonb default '{}';

-- Granular source tracking (UTM/campaign), alongside the existing
-- coarse candidates.source (public_application/hr_upload).
alter table applications add column if not exists source_detail text;

-- Self-scheduling: staff propose open time slots for an application's
-- interview; the candidate books one from the no-login status page.
-- No anon/authenticated-public RLS policy here by design — candidate
-- access goes through the `scheduling` Edge Function (service role),
-- validated against their status_token, same pattern as chat_messages.
create table interview_slots (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications(id) on delete cascade not null,
  interviewer_id uuid references users(id),
  starts_at timestamptz not null,
  duration_minutes int not null default 30,
  status text check (status in ('open','booked','cancelled')) default 'open',
  created_by uuid references users(id),
  created_at timestamptz default now()
);
create index idx_interview_slots_application on interview_slots(application_id);

alter table interview_slots enable row level security;

create policy "interview_slots_staff_all"
  on interview_slots for all
  to authenticated
  using (is_admin_or_recruiter() or interviewer_id = current_staff_id())
  with check (is_admin_or_recruiter() or interviewer_id = current_staff_id());
