-- Extensions and shared utility functions used by every later migration.

create extension if not exists pgcrypto;

-- Generic "bump updated_at on write" trigger, attached per-table below.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
