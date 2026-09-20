-- New top-level routes added for the password-reset and company-invite
-- flows: /reset-password and /invite/[token]. Keep in sync with the
-- mirror in src/lib/tenant.ts.
insert into public.reserved_slugs (slug) values
  ('reset-password'),
  ('invite')
on conflict (slug) do nothing;
