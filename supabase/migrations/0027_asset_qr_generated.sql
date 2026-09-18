-- Remember that a QR tag has been generated for this asset so the
-- detail page can show it again after a reload, until someone clicks
-- Regenerate (which just refreshes the same public /tag/{id} code).
alter table public.assets
  add column if not exists qr_generated_at timestamptz;
