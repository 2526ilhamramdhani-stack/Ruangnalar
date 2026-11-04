-- Standardized metadata for Admin Workspace Handout and HTML inputs.
-- Existing rows remain valid; new submissions are validated by their API handlers.
alter table if exists public.learning_contents
  add column if not exists comment text;

alter table if exists public.custom_html_modules
  add column if not exists subject_id text,
  add column if not exists topic text,
  add column if not exists author_name text,
  add column if not exists comment text;

create index if not exists custom_html_modules_subject_id_idx
  on public.custom_html_modules (subject_id);
