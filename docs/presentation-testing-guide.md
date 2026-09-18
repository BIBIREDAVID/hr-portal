# Live Demo / Presentation Testing Guide

A script for testing the HR Interview Portal live in front of an audience. Follow it
top to bottom — each section is a role, each row is a click-and-check step. Reference
screenshots of expected results are in [docs/screenshots](screenshots) (one folder per
role) if you want to sanity-check beforehand.

**Before you start:** make sure the app is running (`npm run dev`, see
[README.md](../README.md)) and you have it open in a browser at the login page.

## Login credentials

| Role | Email | Password |
|---|---|---|
| Admin | `admin@hrportal.test` | `Password123!` |
| Recruiter | `recruiter1@hrportal.test` | `Password123!` |
| Recruiter | `recruiter2@hrportal.test` | `Password123!` |
| Interviewer | `interviewer1@hrportal.test` | `Password123!` |

---

## Part 1 — Admin walkthrough (`admin@hrportal.test`)

Shows the full feature set: nothing is hidden from admin.

| # | Do this | What you should see |
|---|---|---|
| 1 | Sign in with the admin credentials above | Dashboard loads, sidebar greeting says "Welcome, Alex Morgan" |
| 2 | Look at the sidebar | Dashboard, Jobs, Applications, Interviews, Calendar, Reports, **Settings** all visible |
| 3 | Click **Jobs** | List of job postings loads (or "+ New job" if empty) |
| 4 | Click **Applications** | Candidate pipeline / kanban view loads |
| 5 | Click **Interviews** | Scheduled interviews list loads |
| 6 | Click **Calendar** | Calendar view loads |
| 7 | Click **Reports** | Reporting dashboard loads |
| 8 | Click **Settings** | Email trigger settings page loads (this is the page only admin/recruiter can reach) |
| 9 | Click **Sign out** | Returns to the login screen |

**Talking point:** admin and recruiter have identical access in this app — the only
role restriction is on `interviewer`, shown in Part 3.

---

## Part 2 — Recruiter walkthrough (`recruiter1@hrportal.test`)

Confirms a second, independent staff account behaves the same as admin.

| # | Do this | What you should see |
|---|---|---|
| 1 | Sign in with the recruiter credentials above | Dashboard loads, greeting says "Welcome, Priya Nair" |
| 2 | Look at the sidebar | Same full nav as admin, including **Settings** |
| 3 | Click through Jobs → Applications → Interviews → Calendar → Reports → Settings | Every page loads normally, same as Part 1 |
| 4 | Click **Sign out** | Returns to the login screen |

*(Optional: repeat with `recruiter2@hrportal.test` / Jordan Lee to show two different
staff accounts side by side.)*

---

## Part 3 — Interviewer walkthrough (`interviewer1@hrportal.test`)

This is the role-restriction demo — the interesting part to show live.

| # | Do this | What you should see |
|---|---|---|
| 1 | Sign in with the interviewer credentials above | Dashboard loads, greeting says "Welcome, Sam Okafor" |
| 2 | Look at the sidebar | **Settings is missing** — nav only shows Dashboard, Jobs, Applications, Interviews, Calendar, Reports |
| 3 | Click **Jobs** | Page shows **"Not authorized — your role (interviewer) doesn't have access to this page"** |
| 4 | Click **Reports** | Same "Not authorized" message |
| 5 | Try typing `/dashboard/settings/email-triggers` directly into the address bar | Still blocked with "Not authorized" — proves it's enforced server-side/route-guard, not just a hidden link |
| 6 | Click **Applications**, **Interviews**, **Calendar** | These load normally — interviewers can see candidate pipeline and their own interviews, just not manage jobs/reports/settings |
| 7 | Click **Sign out** | Returns to the login screen |

**Talking point:** the restriction is enforced by a route guard
([RequireRole.jsx](../src/components/RequireRole.jsx)) plus Postgres Row-Level Security
policies — even a direct URL or a raw API call can't bypass it, not just the UI hiding
a link.

---

## Wrap-up checklist

- [ ] Admin: full access confirmed
- [ ] Recruiter: full access confirmed
- [ ] Interviewer: Settings hidden from nav
- [ ] Interviewer: Jobs blocked ("Not authorized")
- [ ] Interviewer: Reports blocked ("Not authorized")
- [ ] Interviewer: direct URL to Settings still blocked
- [ ] Interviewer: Applications/Interviews/Calendar still accessible
- [ ] Sign-out works and returns to `/login` for every account
