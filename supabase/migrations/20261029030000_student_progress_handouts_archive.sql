-- RuangNalar phase 1: secure student identity, progress, handout structure, and archive metadata.
-- This migration is additive. It does not change the existing admin cookie flow.
-- Run in Supabase SQL Editor after the three existing learning_contents migrations.

create table if not exists public.student_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learning_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  progress_key text not null check (char_length(progress_key) between 1 and 180),
  subject_id text not null check (subject_id in ('matematika-wajib','matematika-lanjut','kimia','fisika','fiqih')),
  progress_type text not null check (progress_type in ('lesson','practice','formative','summative')),
  content_id uuid references public.learning_contents(id) on delete set null,
  state jsonb not null default '{}'::jsonb,
  score numeric(5,2) check (score is null or (score >= 0 and score <= 100)),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, progress_key)
);

create index if not exists learning_progress_user_updated_idx
  on public.learning_progress (user_id, updated_at desc);
create index if not exists learning_progress_user_subject_idx
  on public.learning_progress (user_id, subject_id, progress_type);

-- Each handout section is structured data, not a single unformatted text blob.
create table if not exists public.handout_sections (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.learning_contents(id) on delete cascade,
  section_type text not null check (section_type in ('overview','mindmap','real_world','slides','cheatsheet','mnemonic','encouragement','question_types','question_ideas','practice_module','sources')),
  title text not null default '' check (char_length(title) <= 180),
  body jsonb not null default '{}'::jsonb,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (content_id, section_type, position)
);

create index if not exists handout_sections_content_position_idx
  on public.handout_sections (content_id, position);

-- Store metadata and selected Google Drive references; OAuth tokens are never stored here.
create table if not exists public.archive_files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  subject_id text check (subject_id is null or subject_id in ('matematika-wajib','matematika-lanjut','kimia','fisika','fiqih')),
  title text not null check (char_length(title) between 1 and 180),
  description text not null default '' check (char_length(description) <= 4000),
  mime_type text not null default 'application/octet-stream',
  storage_provider text not null check (storage_provider in ('google_drive','supabase_storage','external_link')),
  provider_file_id text,
  file_url text,
  linked_content_id uuid references public.learning_contents(id) on delete set null,
  visibility text not null default 'private' check (visibility in ('private','published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (storage_provider = 'google_drive' and provider_file_id is not null)
    or (storage_provider <> 'google_drive')
  )
);

create index if not exists archive_files_owner_created_idx
  on public.archive_files (owner_id, created_at desc);
create index if not exists archive_files_subject_visibility_idx
  on public.archive_files (subject_id, visibility, created_at desc);

-- Extend learning_contents without replacing legacy fields or content.
alter table public.learning_contents
  add column if not exists source_file_name text not null default '',
  add column if not exists source_file_mime_type text not null default '',
  add column if not exists source_archive_file_id uuid references public.archive_files(id) on delete set null,
  add column if not exists source_references jsonb not null default '[]'::jsonb,
  add column if not exists handout_version integer not null default 1 check (handout_version > 0),
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null;

alter table public.student_profiles enable row level security;
alter table public.learning_progress enable row level security;
alter table public.handout_sections enable row level security;
alter table public.archive_files enable row level security;

-- A student can only see and modify their own profile and progress.
drop policy if exists student_profiles_select_self on public.student_profiles;
create policy student_profiles_select_self on public.student_profiles
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists student_profiles_insert_self on public.student_profiles;
create policy student_profiles_insert_self on public.student_profiles
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists student_profiles_update_self on public.student_profiles;
create policy student_profiles_update_self on public.student_profiles
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists learning_progress_select_self on public.learning_progress;
create policy learning_progress_select_self on public.learning_progress
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists learning_progress_insert_self on public.learning_progress;
create policy learning_progress_insert_self on public.learning_progress
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists learning_progress_update_self on public.learning_progress;
create policy learning_progress_update_self on public.learning_progress
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists learning_progress_delete_self on public.learning_progress;
create policy learning_progress_delete_self on public.learning_progress
  for delete to authenticated using (auth.uid() = user_id);

-- Handout sections are readable only when their parent content is published.
drop policy if exists handout_sections_read_published on public.handout_sections;
create policy handout_sections_read_published on public.handout_sections
  for select to authenticated using (
    exists (
      select 1 from public.learning_contents lc
      where lc.id = handout_sections.content_id
        and lc.status = 'published'
        and lc.published = true
    )
  );

-- Archive metadata is private to its owner by default. Published archives are
-- readable by signed-in students; all writes remain server-mediated for now.
drop policy if exists archive_files_read_owner_or_published on public.archive_files;
create policy archive_files_read_owner_or_published on public.archive_files
  for select to authenticated using (
    owner_id = auth.uid() or visibility = 'published'
  );

-- Do not grant direct browser writes to profile/progress, handout sections, or archive metadata yet.
-- Writes remain server-mediated until dedicated endpoints validate the Supabase Auth
-- bearer token and compute exam scores server-side. Do not let clients self-report grades.
revoke all on public.student_profiles from anon;
revoke all on public.learning_progress from anon;
revoke all on public.handout_sections from anon;
revoke all on public.archive_files from anon;
revoke all on public.student_profiles from authenticated;
grant select on public.student_profiles to authenticated;
revoke all on public.learning_progress from authenticated;
grant select on public.learning_progress to authenticated;
revoke all on public.handout_sections from authenticated;
grant select on public.handout_sections to authenticated;
revoke all on public.archive_files from authenticated;
grant select on public.archive_files to authenticated;
