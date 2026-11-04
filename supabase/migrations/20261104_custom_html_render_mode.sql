-- Distinguish original HTML documents from RuNa-authored custom modules.
-- Existing records remain in the current module mode.
alter table public.custom_html_modules
  add column if not exists render_mode text not null default 'module'
  check (render_mode in ('module', 'raw'));
