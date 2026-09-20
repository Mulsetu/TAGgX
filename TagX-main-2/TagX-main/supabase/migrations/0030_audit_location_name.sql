-- Safe to run if 0029 already landed without this snapshot column.
alter table public.audits
  add column if not exists location_name text;
