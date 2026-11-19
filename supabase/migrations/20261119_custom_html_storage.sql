-- RuNa HTML modules: move file bodies to private Supabase Storage.
-- Existing rows keep their html column values and remain readable during migration.
alter table public.custom_html_modules
  add column if not exists storage_path text;

alter table public.custom_html_modules
  alter column html drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'custom_html_modules_html_or_storage_check'
      and conrelid = 'public.custom_html_modules'::regclass
  ) then
    alter table public.custom_html_modules
      add constraint custom_html_modules_html_or_storage_check
      check (html is not null or storage_path is not null);
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'runa-html-modules',
  'runa-html-modules',
  false,
  15728640,
  array['text/html', 'text/plain', 'application/octet-stream']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = 15728640,
  allowed_mime_types = array['text/html', 'text/plain', 'application/octet-stream'];

-- No browser role receives direct access. The API signs short-lived upload/read URLs
-- after validating the existing RuNa Admin session.
