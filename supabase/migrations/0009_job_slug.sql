-- Human-readable slugs for job apply links, e.g. /apply/sales-officer
-- instead of /apply/<uuid>. Generated once at creation time and kept
-- stable afterwards so shared links never break when a title is edited.

alter table jobs add column slug text;

-- Backfill existing jobs: slugify the title, de-duplicating by
-- appending the first 8 chars of the id when needed.
with base as (
  select
    id,
    regexp_replace(regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') as base_slug
  from jobs
),
numbered as (
  select id, base_slug, row_number() over (partition by base_slug order by id) as rn
  from base
)
update jobs
set slug = case when numbered.rn = 1 then numbered.base_slug else numbered.base_slug || '-' || substr(jobs.id::text, 1, 8) end
from numbered
where jobs.id = numbered.id;

alter table jobs alter column slug set not null;
alter table jobs add constraint jobs_slug_unique unique (slug);
create index idx_jobs_slug on jobs(slug);
