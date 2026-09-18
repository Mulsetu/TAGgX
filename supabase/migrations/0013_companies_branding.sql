-- Branding shown on a company's tenant-scoped login page
-- (src/app/(tenant)/[slug]/login). logo_url stores an R2 object URL, not a
-- signed path — it must already be a publicly-servable URL if set.

alter table public.companies
  add column logo_url text,
  add column primary_color text
    constraint companies_primary_color_format check (
      primary_color is null or primary_color ~ '^#[0-9a-fA-F]{6}$'
    ),
  add column secondary_color text
    constraint companies_secondary_color_format check (
      secondary_color is null or secondary_color ~ '^#[0-9a-fA-F]{6}$'
    );
