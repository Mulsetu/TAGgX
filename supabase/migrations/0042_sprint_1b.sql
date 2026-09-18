-- TAGX-010: platform suspend switch (login block).
alter table public.companies
  add column if not exists suspended_at timestamptz;

-- TAGX-012: store only a hash of invite tokens. Outstanding plaintext
-- invites are expired so a leaked `token` column cannot be used.
alter table public.company_invites
  add column if not exists token_hash text;

alter table public.company_invites
  drop constraint if exists company_invites_token_key;

drop index if exists company_invites_token_key;

alter table public.company_invites
  alter column token drop not null;

update public.company_invites
  set expires_at = least(expires_at, now()),
      token = null
  where accepted_at is null;

create unique index if not exists company_invites_token_hash_key
  on public.company_invites (token_hash)
  where token_hash is not null;

-- TAGX-017: photo captured when an audit records an exception.
alter table public.audit_items
  add column if not exists exception_photo_path text;
