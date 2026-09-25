-- =========================================================================
-- Automated interview reminders — schema only.
--
-- Adds a flag so the reminder function (supabase/functions/
-- send-interview-reminders) only ever emails/notifies once per interview.
-- The pg_cron schedule that calls it on a timer is deliberately NOT set up
-- here — see supabase/CRON_SETUP.md for that step. Keeping it out of this
-- migration means this file never has to contain the shared secret the
-- cron job authenticates with, which shouldn't be committed to git or
-- pushed as plain SQL.
-- =========================================================================

alter table interviews add column if not exists reminder_sent_at timestamptz;

-- Only meaningful for the function's "due soon and not yet reminded" scan.
create index if not exists idx_interviews_reminder_scan
  on interviews (status, scheduled_at)
  where reminder_sent_at is null;
