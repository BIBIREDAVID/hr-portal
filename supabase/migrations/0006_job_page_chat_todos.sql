-- =========================================================================
-- Spec update — job page builder, star rating, in-app chat, HR to-dos,
-- calendar. See hr-interview-portal-spec.md Section 4 for the schema
-- additions this migration implements, and Section 7 Phases 2/4/5/6.
-- =========================================================================

-- ---------------------------------------------------------------------
-- Jobs: page builder + location fields
-- ---------------------------------------------------------------------

alter table jobs
  add column if not exists headline text,
  add column if not exists hero_image_url text,
  add column if not exists benefits jsonb default '[]',
  add column if not exists tasks jsonb default '[]',
  add column if not exists requirements_list jsonb default '[]',
  add column if not exists locations text[] default '{}',
  add column if not exists work_mode text check (work_mode in ('onsite','remote','hybrid')) default 'onsite';

-- ---------------------------------------------------------------------
-- Applications: quick 1-5 star rating alongside the numeric score
-- ---------------------------------------------------------------------

alter table applications
  add column if not exists rating smallint check (rating between 1 and 5);

-- ---------------------------------------------------------------------
-- Storage: job-assets bucket for hero images. Public (unlike resumes) —
-- these are marketing images meant to render on the public job page.
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'job-assets',
  'job-assets',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "job_assets_public_read" on storage.objects;
create policy "job_assets_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'job-assets');

drop policy if exists "job_assets_staff_write" on storage.objects;
create policy "job_assets_staff_write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'job-assets' and is_admin_or_recruiter());

drop policy if exists "job_assets_staff_delete" on storage.objects;
create policy "job_assets_staff_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'job-assets' and is_admin_or_recruiter());

-- ---------------------------------------------------------------------
-- chat_messages: lightweight HR <-> candidate messaging per application.
-- Candidates have no account, so their side is never touched by direct
-- client RLS — only the `chat` Edge Function (service role) reads/writes
-- on their behalf after validating their status_token server-side. RLS
-- here only covers the STAFF side.
-- ---------------------------------------------------------------------

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications(id) on delete cascade,
  sender_type text check (sender_type in ('hr','candidate')) not null,
  sender_user_id uuid references users(id),
  body text not null,
  read_by_hr boolean default false,
  read_by_candidate boolean default false,
  created_at timestamptz default now()
);
create index idx_chat_messages_application on chat_messages(application_id, created_at);

alter table chat_messages enable row level security;

-- Staff read: same scoping as applications (admin/recruiter see
-- everything; an interviewer sees threads only on applications they're
-- assigned to interview).
create policy "chat_staff_select"
  on chat_messages for select
  to authenticated
  using (is_admin_or_recruiter() or is_interviewer_for_application(application_id));

-- Staff write: admin/recruiter only. Chatting with a candidate is a
-- recruiting action, not something the interviewer role needs — a
-- narrower read than the interviewer's usual scope, worth knowing if
-- that assumption turns out wrong.
create policy "chat_staff_insert"
  on chat_messages for insert
  to authenticated
  with check (
    is_admin_or_recruiter()
    and sender_type = 'hr'
    and sender_user_id = current_staff_id()
  );

-- Marking messages read (read_by_hr) is the only staff-side update.
create policy "chat_staff_update"
  on chat_messages for update
  to authenticated
  using (is_admin_or_recruiter())
  with check (is_admin_or_recruiter());

-- Same immutability guard as notes/interviews (Phase 9 audit, 0005):
-- nothing should ever move a message onto a different application.
create or replace function public.prevent_chat_message_reassignment()
returns trigger
language plpgsql
as $$
begin
  if old.application_id is distinct from new.application_id then
    raise exception 'chat_messages.application_id cannot be changed after creation';
  end if;
  return new;
end;
$$;

create trigger trg_chat_messages_no_reassign
before update on chat_messages
for each row execute function public.prevent_chat_message_reassignment();

-- ---------------------------------------------------------------------
-- hr_todos: strictly personal per-user to-do list, surfaced standalone
-- and on the calendar.
-- ---------------------------------------------------------------------

create table hr_todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  title text not null,
  due_at timestamptz,
  completed boolean default false,
  created_at timestamptz default now()
);

alter table hr_todos enable row level security;

create policy "hr_todos_own"
  on hr_todos for all
  to authenticated
  using (user_id = current_staff_id())
  with check (user_id = current_staff_id());
