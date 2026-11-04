-- RuNa Custom HTML Modules
-- Admin-managed HTML modules. Rendered only inside a sandboxed iframe in the app.
create table if not exists public.custom_html_modules (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '',
  html text not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists custom_html_modules_status_updated_idx
  on public.custom_html_modules (status, updated_at desc);

alter table public.custom_html_modules enable row level security;
-- Browser clients receive no direct table access. The server API uses the service role
-- and enforces the existing signed RuNa Admin session for all mutations/draft reads.
revoke all on public.custom_html_modules from anon, authenticated;
