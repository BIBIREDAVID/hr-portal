-- =========================================================================
-- get_application_status needs to also return the application id: the
-- candidate-side chat panel on /status/:token (Section 6/7, item 12)
-- needs it to know which application's thread to load, and a candidate
-- can have more than one application. Still no email/phone/resume/score
-- exposed — same privacy stance as the original function (0002).
--
-- Return type changed, so this must DROP + CREATE rather than
-- CREATE OR REPLACE (Postgres won't let you REPLACE a function into a
-- different return signature).
-- =========================================================================

drop function if exists public.get_application_status(uuid);

create function public.get_application_status(p_token uuid)
returns table (
  application_id uuid,
  job_title text,
  department text,
  stage text,
  stage_updated_at timestamptz,
  candidate_name text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select a.id, j.title, j.department, a.stage, a.stage_updated_at, c.name
  from candidates c
  join applications a on a.candidate_id = c.id
  join jobs j on j.id = a.job_id
  where c.status_token = p_token::text
  order by a.stage_updated_at desc;
$$;

revoke all on function public.get_application_status(uuid) from public;
grant execute on function public.get_application_status(uuid) to anon, authenticated;
