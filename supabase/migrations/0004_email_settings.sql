-- =========================================================================
-- Phase 7 — Bulk actions & emails
-- See hr-interview-portal-spec.md Section 7 (Phase 7), item 18:
-- "Stage-change email triggers (configurable per stage)".
--
-- The Section 4 schema has nowhere to store that config, and it doesn't
-- belong on `jobs` (it's an org-wide policy, not per-posting). This adds
-- one small generic settings table rather than a single-purpose one, so
-- future org-wide config doesn't need its own migration each time.
-- =========================================================================

create table app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

alter table app_settings enable row level security;

create policy "app_settings_staff_select"
  on app_settings for select
  to authenticated
  using (is_admin_or_recruiter());

create policy "app_settings_staff_write"
  on app_settings for all
  to authenticated
  using (is_admin_or_recruiter())
  with check (is_admin_or_recruiter());

-- Default: no automatic stage-change emails until HR opts in per stage.
insert into app_settings (key, value)
values ('stage_email_triggers', '{}'::jsonb)
on conflict (key) do nothing;
