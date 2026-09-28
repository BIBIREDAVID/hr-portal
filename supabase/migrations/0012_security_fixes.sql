-- =========================================================================
-- Security + access fixes from the 2026-09-28 end-to-end test run.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Staff users could promote themselves to admin.
--
-- users_update_self_or_admin lets a user update their OWN row, and RLS
-- can't restrict which columns change — so any interviewer/recruiter
-- could `update users set role = 'admin' where auth_id = auth.uid()`.
-- users_insert_self had the same gap: any Supabase Auth login (public
-- sign-up is enabled on the project) could insert its own row with any
-- role. This trigger closes both for end-user requests:
--   - INSERT: only allowed when the table is empty (first-ever login
--     bootstraps the org as admin). Every later staff row is created by
--     the invite-staff Edge Function (service role).
--   - UPDATE: non-admins can't change role, auth_id, or email.
-- Requests with no end-user JWT (service role, SQL editor) are exempt:
-- auth.uid() is null for them.
-- -------------------------------------------------------------------------
create or replace function public.guard_users_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if exists (select 1 from users) then
      raise exception 'Staff accounts are created by an admin (invite-staff)';
    end if;
    new.role := 'admin';
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Only an admin can change a staff role';
  end if;
  if new.auth_id is distinct from old.auth_id or new.email is distinct from old.email then
    raise exception 'Only an admin can change a staff login';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_users_guard on users;
create trigger trg_users_guard
before insert or update on users
for each row execute function public.guard_users_write();

-- -------------------------------------------------------------------------
-- 2. Panelists couldn't see or update interviews they're on.
--
-- Since 0010 the dashboard schedules interviews by adding panel members
-- (interview_panel) and leaves interviews.interviewer_id null, but the
-- interviewer policies still only matched interviewer_id — so a
-- panelist never saw the interview on /dashboard/interviews and
-- couldn't record status/feedback.
-- -------------------------------------------------------------------------
revoke execute on function public.is_panelist_for_interview(uuid) from public;
grant execute on function public.is_panelist_for_interview(uuid) to authenticated;

drop policy if exists "interviews_interviewer_select" on interviews;
create policy "interviews_interviewer_select"
  on interviews for select
  to authenticated
  using (interviewer_id = current_staff_id() or is_panelist_for_interview(id));

drop policy if exists "interviews_interviewer_update" on interviews;
create policy "interviews_interviewer_update"
  on interviews for update
  to authenticated
  using (interviewer_id = current_staff_id() or is_panelist_for_interview(id))
  with check (interviewer_id = current_staff_id() or is_panelist_for_interview(id));

-- Now that panelists can update, stop a non-HR user from reassigning the
-- interview (interviewer_id) or moving it to another stage — they may
-- only record status/feedback/scorecard. application_id was already
-- locked for everyone by 0005.
create or replace function public.prevent_interview_reassignment()
returns trigger
language plpgsql
as $$
begin
  if old.application_id is distinct from new.application_id then
    raise exception 'interviews.application_id cannot be changed after creation';
  end if;
  if not public.is_admin_or_recruiter() and auth.uid() is not null then
    if old.interviewer_id is distinct from new.interviewer_id then
      raise exception 'Only HR can change who conducts an interview';
    end if;
    if old.stage_id is distinct from new.stage_id then
      raise exception 'Only HR can change an interview''s stage';
    end if;
  end if;
  return new;
end;
$$;

-- -------------------------------------------------------------------------
-- 3. Candidate-booked interviews had no panel, so the interviewer
-- couldn't score them (interview_scores_own_insert requires panel
-- membership). The scheduling function now adds the panel row; this
-- backfills interviews created before that fix.
-- -------------------------------------------------------------------------
insert into interview_panel (interview_id, user_id)
select id, interviewer_id from interviews where interviewer_id is not null
on conflict do nothing;

-- -------------------------------------------------------------------------
-- 4. Interviewers could download every resume in the bucket.
--
-- 0003 widened resumes_staff_read to any authenticated user so
-- interviewers could read their candidate's resume — but that also
-- exposed every other candidate's resume to them. Scope it: HR reads
-- all; an interviewer reads only resumes of candidates on an
-- application they're interviewing for.
-- -------------------------------------------------------------------------
create or replace function public.can_read_resume(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_admin_or_recruiter()
  or exists (
    select 1
    from candidates c
    join applications a on a.candidate_id = c.id
    where c.resume_url = object_name
      and public.is_interviewer_for_application(a.id)
  );
$$;

revoke execute on function public.can_read_resume(text) from public;
grant execute on function public.can_read_resume(text) to authenticated;

drop policy if exists "resumes_staff_read" on storage.objects;
create policy "resumes_staff_read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'resumes' and public.can_read_resume(name));
