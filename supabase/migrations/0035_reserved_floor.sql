insert into public.reserved_slugs (slug) values ('floor')
on conflict (slug) do nothing;
