-- =========================================================================
-- Interview process overhaul: configurable per-job interview stages with
-- weighted scoring criteria, a reusable question library, multi-interviewer
-- panels per interview, per-panelist structured scoring, and a slot for the
-- rule-based CV analysis report. See the plan this migration was built
-- from for full context.
-- =========================================================================

-- Per-job interview stages (e.g. Screening / Technical / Final), each with
-- its own weighted criteria. A job typically has 3, but this isn't
-- hardcoded — app code seeds 3 defaults on job creation.
create table job_interview_stages (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade not null,
  name text not null,
  order_index int not null,
  criteria jsonb default '[]',   -- [{"label": "Communication", "weight": 1}, ...]
  created_at timestamptz default now(),
  unique (job_id, order_index)
);
create index idx_job_interview_stages_job on job_interview_stages(job_id);

-- Reusable bank of interview questions, browsable/filterable by role and
-- stage, independent of any one job.
create table question_library (
  id uuid primary key default gen_random_uuid(),
  role_category text not null,
  stage_name text,
  question_text text not null,
  is_default_for_role boolean default false,
  created_by uuid references users(id),
  created_at timestamptz default now()
);
create index idx_question_library_role on question_library(role_category);

-- Links a job's stage to specific questions, whether pulled from the
-- library or added ad hoc (an ad hoc question is just a question_library
-- row with is_default_for_role = false, linked immediately).
create table stage_questions (
  stage_id uuid references job_interview_stages(id) on delete cascade not null,
  question_id uuid references question_library(id) on delete cascade not null,
  order_index int not null default 0,
  primary key (stage_id, question_id)
);

-- Multi-interviewer panel per interview. Supersedes interviews.interviewer_id
-- as the source of truth for "who is on this interview" — that column is
-- kept (nullable) as a legacy/primary pointer for backward compatibility.
create table interview_panel (
  interview_id uuid references interviews(id) on delete cascade not null,
  user_id uuid references users(id) on delete cascade not null,
  added_at timestamptz default now(),
  primary key (interview_id, user_id)
);
create index idx_interview_panel_user on interview_panel(user_id);

-- Backfill: every interview that already has a single interviewer_id gets
-- that person as their one panel member.
insert into interview_panel (interview_id, user_id)
select id, interviewer_id from interviews where interviewer_id is not null
on conflict do nothing;

alter table interviews add column if not exists stage_id uuid references job_interview_stages(id);

-- Each panelist scores each criterion independently; the UI averages
-- across panelists per criterion.
create table interview_scores (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid references interviews(id) on delete cascade not null,
  interviewer_id uuid references users(id) not null,
  criterion_label text not null,
  score numeric(3,1),
  notes text,
  created_at timestamptz default now(),
  unique (interview_id, interviewer_id, criterion_label)
);
create index idx_interview_scores_interview on interview_scores(interview_id);

-- Rule-based CV analysis output (gaps/overlaps/format issues + suggested
-- questions), run manually per application from the candidate detail page.
alter table applications add column if not exists cv_report jsonb;
alter table applications add column if not exists cv_analyzed_at timestamptz;

-- ---------------------------------------------------------------------
-- Extend is_interviewer_for_application to also recognize panel
-- membership, not just the legacy interviews.interviewer_id column, so
-- newly-added panelists (beyond the first) get the same candidate/
-- resume/application read access the original interviewer had.
-- ---------------------------------------------------------------------
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
  )
  or exists (
    select 1
    from interviews i
    join interview_panel p on p.interview_id = i.id
    join users u on u.id = p.user_id
    where i.application_id = app_id and u.auth_id = auth.uid()
  );
$$;

-- True when the current authenticated user is on the panel for the given
-- interview — used to scope interview_scores writes.
create or replace function public.is_panelist_for_interview(interview_id_arg uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from interview_panel p
    join users u on u.id = p.user_id
    where p.interview_id = interview_id_arg and u.auth_id = auth.uid()
  );
$$;

-- =========================================================================
-- Row-Level Security
-- =========================================================================

alter table job_interview_stages enable row level security;
alter table question_library enable row level security;
alter table stage_questions enable row level security;
alter table interview_panel enable row level security;
alter table interview_scores enable row level security;

-- job_interview_stages: admin/recruiter full CRUD; interviewers read-only
-- (need to see criteria for interviews they're on).
create policy "job_interview_stages_staff_all"
  on job_interview_stages for all
  to authenticated
  using (is_admin_or_recruiter())
  with check (is_admin_or_recruiter());

create policy "job_interview_stages_interviewer_select"
  on job_interview_stages for select
  to authenticated
  using (current_staff_role() = 'interviewer');

-- question_library: same shape — admin/recruiter manage, interviewers can
-- browse.
create policy "question_library_staff_all"
  on question_library for all
  to authenticated
  using (is_admin_or_recruiter())
  with check (is_admin_or_recruiter());

create policy "question_library_interviewer_select"
  on question_library for select
  to authenticated
  using (current_staff_role() = 'interviewer');

-- stage_questions: same shape.
create policy "stage_questions_staff_all"
  on stage_questions for all
  to authenticated
  using (is_admin_or_recruiter())
  with check (is_admin_or_recruiter());

create policy "stage_questions_interviewer_select"
  on stage_questions for select
  to authenticated
  using (current_staff_role() = 'interviewer');

-- interview_panel: admin/recruiter manage assignments; a staff member can
-- see panels they're a member of (so an interviewer can see their
-- co-panelists).
create policy "interview_panel_staff_all"
  on interview_panel for all
  to authenticated
  using (is_admin_or_recruiter())
  with check (is_admin_or_recruiter());

create policy "interview_panel_own_select"
  on interview_panel for select
  to authenticated
  using (user_id = current_staff_id());

-- interview_scores: admin/recruiter full read; a panelist can insert/
-- update only their own score rows, and only for interviews they're
-- actually on (mirrors interviews_interviewer_update's self-scoping).
create policy "interview_scores_staff_select"
  on interview_scores for select
  to authenticated
  using (is_admin_or_recruiter());

create policy "interview_scores_own_select"
  on interview_scores for select
  to authenticated
  using (interviewer_id = current_staff_id());

create policy "interview_scores_own_insert"
  on interview_scores for insert
  to authenticated
  with check (
    interviewer_id = current_staff_id()
    and is_panelist_for_interview(interview_id)
  );

create policy "interview_scores_own_update"
  on interview_scores for update
  to authenticated
  using (interviewer_id = current_staff_id())
  with check (interviewer_id = current_staff_id());

create policy "interview_scores_staff_write"
  on interview_scores for all
  to authenticated
  using (is_admin_or_recruiter())
  with check (is_admin_or_recruiter());
