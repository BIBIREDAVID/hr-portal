-- =========================================================================
-- Phase 3 — Public intake
-- Storage for resumes, and a public RPC for the no-login status page.
-- See hr-interview-portal-spec.md Section 7 (Phase 3) and Section 8
-- (Security Checklist).
-- =========================================================================

-- ---------------------------------------------------------------------
-- Storage: resumes bucket
-- Private bucket — objects are not publicly readable. Anyone (including
-- anon) may UPLOAD a resume as part of applying; only admin/recruiter
-- staff may read objects back (e.g. to generate a signed URL in the
-- candidate detail view, built in Phase 4). Type/size are enforced at
-- the bucket level as defense in depth alongside the client-side check
-- in the apply form.
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resumes',
  'resumes',
  false,
  5242880, -- 5MB, per Section 8
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "resumes_public_upload" on storage.objects;
create policy "resumes_public_upload"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'resumes');

drop policy if exists "resumes_staff_read" on storage.objects;
create policy "resumes_staff_read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'resumes' and public.is_admin_or_recruiter());

-- ---------------------------------------------------------------------
-- get_application_status(token)
-- Backs the public /status/:token page. Security definer so it can read
-- across candidates/applications/jobs (all otherwise staff-only) while
-- returning ONLY the fields a candidate should see about their own
-- application(s) — no email, phone, resume, score, or notes.
-- ---------------------------------------------------------------------

-- `candidates.status_token` is `text` per the Section 4 schema (not
-- `uuid` — it's declared `text unique default gen_random_uuid()`), so
-- the comparison below casts the token param to text. Postgres has no
-- implicit text = uuid operator and errors on this without the cast.
create or replace function public.get_application_status(p_token uuid)
returns table (
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
  select j.title, j.department, a.stage, a.stage_updated_at, c.name
  from candidates c
  join applications a on a.candidate_id = c.id
  join jobs j on j.id = a.job_id
  where c.status_token = p_token::text
  order by a.stage_updated_at desc;
$$;

revoke all on function public.get_application_status(uuid) from public;
grant execute on function public.get_application_status(uuid) to anon, authenticated;
