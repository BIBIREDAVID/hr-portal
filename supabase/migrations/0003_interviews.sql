-- =========================================================================
-- Phase 6 — Interviews
-- See hr-interview-portal-spec.md Section 7 (Phase 6): interview
-- scheduling, feedback capture, and the interviewer-scoped view.
-- =========================================================================

-- Phase 1 gave interviewers read-only access to their own interviews
-- (interviews_interviewer_select). "Feedback capture" (item 15) requires
-- more than that — the assigned interviewer has to be able to record
-- status/feedback themselves, not only have HR do it on their behalf.
-- This adds a scoped UPDATE: an interviewer can only touch a row where
-- they're already the interviewer, and WITH CHECK blocks them from
-- reassigning it to someone else (the new row must still name them).
create policy "interviews_interviewer_update"
  on interviews for update
  to authenticated
  using (interviewer_id = current_staff_id())
  with check (interviewer_id = current_staff_id());

-- Interviewers reviewing a candidate ahead of their interview need the
-- resume too, not just the pipeline metadata Phase 1 already exposed
-- them to (candidates_interviewer_select / applications_interviewer_select).
-- The bucket stays private to staff generally — this only widens who
-- counts as "staff" for read access, from admin/recruiter to any
-- authenticated HR user.
drop policy "resumes_staff_read" on storage.objects;

create policy "resumes_staff_read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'resumes');
