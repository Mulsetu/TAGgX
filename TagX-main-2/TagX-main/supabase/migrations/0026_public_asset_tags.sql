-- Public QR tag pages live at /tag/[id]. Reserve the slug so a company
-- can't collide with it. Keep in sync with src/lib/tenant.ts.
insert into public.reserved_slugs (slug) values ('tag')
on conflict (slug) do nothing;

-- Public scan reports (name + email, no TagX account) land as
-- maintenance tickets. reported_by stays null; these columns hold the
-- scanner's contact details instead.
alter table public.maintenance_tickets
  add column reporter_name text,
  add column reporter_email text;
