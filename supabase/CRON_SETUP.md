# Scheduling automated interview reminders

`send-interview-reminders` (an Edge Function) does the actual work: it scans
for interviews starting in the next 24 hours that haven't been reminded
about yet, emails the candidate + panelists, and stamps `reminder_sent_at`
so it's never sent twice. It's already callable on demand from the
dashboard's **Interviews → 🔔 Send reminders now** button.

To also run it automatically every 15 minutes, do this once, yourself, from
somewhere that isn't shared/committed (the Supabase SQL editor or your own
terminal) — this step is intentionally left out of the migrations and out
of this assistant's tool calls, since it involves a secret value that
shouldn't be pasted into a chat session, a git-tracked file, or a database
migration that ends up in version control.

## 1. Generate a random secret and set it as a function secret

```bash
supabase secrets set CRON_SECRET=$(openssl rand -base64 24)
```

(Or generate the random value however you like — it just needs to be
unguessable. Keep a copy; you'll paste it into the SQL below.)

## 2. Enable pg_cron + pg_net and schedule the job

Run this in the Supabase SQL editor (Database → SQL Editor), substituting
your own project's function URL and the SAME secret value from step 1:

```sql
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'send-interview-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://<your-project-ref>.supabase.co/functions/v1/send-interview-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<same value as CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

To stop the schedule later: `select cron.unschedule('send-interview-reminders');`

## Why this isn't automated for you

Supabase's hosted Postgres doesn't let a migration read the function's
secret back out to embed it in the `net.http_post` call, so the schedule
step unavoidably involves typing (or pasting) the actual secret value into
a SQL statement. Doing that from an assistant session — via a migration
file that gets committed, or a tool call that transmits the value — is
exactly the kind of credential handling this project's tooling (and good
practice generally) blocks by default. It's a two-minute manual step; the
reminder feature itself works fully without it via the manual button.
