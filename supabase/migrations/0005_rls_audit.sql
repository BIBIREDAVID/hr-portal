-- =========================================================================
-- Phase 9 — Final RLS audit
-- See hr-interview-portal-spec.md Section 7 (Phase 9), item 24. Findings
-- from reviewing every policy/function added across Phases 1-8, and the
-- fixes for the ones worth closing before calling this done. Nothing
-- here changes application behavior — every fix targets a path the UI
-- never takes, closing off what a direct API/SQL call could otherwise
-- do.
-- =========================================================================

-- FINDING 1 — helper functions are callable by everyone.
-- current_staff_id/current_staff_role/is_admin/is_admin_or_recruiter/
-- is_interviewer_for_application were created without an explicit
-- GRANT, so Postgres's default (EXECUTE granted to PUBLIC, i.e. anon
-- too) applied. None of them leak cross-user data (they only report on
-- auth.uid()'s own row, or a yes/no for one application id), so this
-- was never exploitable — but an anonymous caller having no reason to
-- invoke them at all is worth tightening on general principle.
revoke execute on function public.current_staff_id() from public;
revoke execute on function public.current_staff_role() from public;
revoke execute on function public.is_admin() from public;
revoke execute on function public.is_admin_or_recruiter() from public;
revoke execute on function public.is_interviewer_for_application(uuid) from public;

grant execute on function public.current_staff_id() to authenticated;
grant execute on function public.current_staff_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin_or_recruiter() to authenticated;
grant execute on function public.is_interviewer_for_application(uuid) to authenticated;

-- FINDING 2 — an interviewer could reassign their own interview record
-- to a DIFFERENT application_id. Phase 6's interviews_interviewer_update
-- policy correctly stops them changing interviewer_id (WITH CHECK
-- forces the new row to still name them), but it never constrained
-- application_id — RLS's WITH CHECK only inspects the NEW row, so it
-- can't itself compare against the OLD row's application_id. A trigger
-- can. This would otherwise let an interviewer point one of their own
-- interviews at any application id (e.g. attaching feedback to a
-- candidate they were never assigned to interview).
create or replace function public.prevent_interview_reassignment()
returns trigger
language plpgsql
as $$
begin
  if old.application_id is distinct from new.application_id then
    raise exception 'interviews.application_id cannot be changed after creation';
  end if;
  return new;
end;
$$;

create trigger trg_interviews_no_reassign
before update on interviews
for each row execute function public.prevent_interview_reassignment();

-- FINDING 3 — notes_staff_all is `for all`, so any admin/recruiter can
-- UPDATE a note's author_id or application_id via a direct API/SQL
-- call (the app's own UI never does this — NotesThread only inserts).
-- Left open, this would let one HR user forge another's authorship on
-- a note, or move a note onto an unrelated application.
create or replace function public.prevent_note_reassignment()
returns trigger
language plpgsql
as $$
begin
  if old.application_id is distinct from new.application_id then
    raise exception 'notes.application_id cannot be changed after creation';
  end if;
  if old.author_id is distinct from new.author_id then
    raise exception 'notes.author_id cannot be changed after creation';
  end if;
  return new;
end;
$$;

create trigger trg_notes_no_reassign
before update on notes
for each row execute function public.prevent_note_reassignment();

-- FINDING 4 — applications_staff_update is similarly broad: nothing
-- stopped candidate_id/job_id from being changed on an existing
-- application, which would silently rewrite which candidate or job an
-- application (and all its interviews/notes/score history) belongs to.
-- The UI never does this (ScoringPanel only ever patches
-- stage/assigned_to/score/score_notes/tags) — this closes the gap for
-- direct API access too.
create or replace function public.prevent_application_reassignment()
returns trigger
language plpgsql
as $$
begin
  if old.candidate_id is distinct from new.candidate_id then
    raise exception 'applications.candidate_id cannot be changed after creation';
  end if;
  if old.job_id is distinct from new.job_id then
    raise exception 'applications.job_id cannot be changed after creation';
  end if;
  return new;
end;
$$;

create trigger trg_applications_no_reassign
before update on applications
for each row execute function public.prevent_application_reassignment();

-- FINDINGS REVIEWED, NO CHANGE NEEDED (left as-is, documented for
-- whoever does the next audit):
--
-- - jobs_public_read_open only checks status = 'open', not expires_at.
--   A job past its expiry but still marked 'open' stays publicly
--   visible/appliable-to in the UI until someone flips its status —
--   the `apply` Edge Function does reject an expired job's submission
--   (checked server-side), so this is a UX gap (a dead job's page stays
--   browsable) rather than a write-path security hole. Auto-closing on
--   expiry would need a scheduled job (pg_cron or an external trigger),
--   which is real added infrastructure — flagging it rather than
--   quietly adding that here.
-- - resumes_staff_read (Phase 6) intentionally covers every
--   authenticated staff role, not just admin/recruiter, so interviewers
--   can review a resume before their interview. Documented in Phase 6's
--   migration; re-confirmed here as intentional, not an oversight.
-- - notifications/saved_filters are scoped to the owning user rather
--   than admin/recruiter, a deliberate deviation from Section 4's
--   literal text — documented in Phase 1's migration, re-confirmed here.
-- - activity_log and email_log have no UPDATE/DELETE policy for any
--   role, so they're already immutable audit trails at the RLS layer —
--   no trigger needed on top of that.
