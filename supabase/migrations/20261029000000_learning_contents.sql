-- Run this migration in Supabase SQL Editor before enabling database publishing.
create extension if not exists pgcrypto;

create table if not exists public.learning_contents (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  topic text not null check (char_length(topic) between 1 and 100),
  summary text not null default '',
  key_points jsonb not null default '[]'::jsonb,
  example text not null default '',
  questions jsonb not null default '[]'::jsonb,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.learning_contents enable row level security;

-- Browser roles cannot write or read this table directly.
-- Public reads are served through /api/content; service-role key stays server-side.
revoke all on public.learning_contents from anon, authenticated;
