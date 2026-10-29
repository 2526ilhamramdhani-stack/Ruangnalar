-- RuangNalar: add stable subject grouping and draft/published workflow.
-- Backward-compatible: existing published rows are assigned to Matematika Wajib.
alter table public.learning_contents
  add column if not exists subject_id text not null default 'matematika-wajib',
  add column if not exists status text not null default 'published';

update public.learning_contents
set status = case when published then 'published' else 'draft' end;

alter table public.learning_contents
  drop constraint if exists learning_contents_subject_id_check;
alter table public.learning_contents
  add constraint learning_contents_subject_id_check
  check (subject_id in ('matematika-wajib','matematika-lanjut','kimia','fisika','fiqih'));

alter table public.learning_contents
  drop constraint if exists learning_contents_status_check;
alter table public.learning_contents
  add constraint learning_contents_status_check
  check (status in ('draft','published'));

create index if not exists learning_contents_subject_status_created_idx
  on public.learning_contents (subject_id, status, created_at desc);

-- Keep the legacy published flag synchronized for existing consumers.
update public.learning_contents set published = (status = 'published');
