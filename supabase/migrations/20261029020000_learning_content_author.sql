-- RuangNalar: store the display name of the admin who publishes each learning material.
-- Existing content remains intact; legacy rows show a clear "Penerbit belum dicatat" label until updated.
alter table public.learning_contents
  add column if not exists author_name text not null default '';
