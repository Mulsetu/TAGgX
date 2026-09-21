-- Same class of gap 0048 closed on users/roles, one table over: assets is
-- the actual inventory/financial data, and "roles with a permission
-- matrix: view/create/edit/delete per area" (docs/CUSTOMER_FEATURES.md)
-- was never true for it at the database layer. `assets_tenant_isolation`
-- is `FOR ALL` scoped only by company_id, so any authenticated tenant
-- member — a Viewer-only role included — could previously:
--   PATCH /rest/v1/assets?id=eq.<any>   {"purchase_price": 1, "allotted_to": "..."}
--   DELETE /rest/v1/assets?company_id=eq.<mine>
-- bypassing the role matrix entirely. The DELETE case is worse than a
-- permission bypass: grepping every `.from("assets")` call in src/ turns
-- up no hard-DELETE at all — every "removal" in the app is the soft-delete
-- UPDATE path (`deleted_at`) in assets/mutations.ts's deleteAsset(). A
-- direct REST DELETE could permanently wipe the whole asset register with
-- no confirmation, no audit log entry, and no recovery.

-- Mirrors current_user_has_permission() across the several permissions
-- that legitimately write to `assets` via a session-scoped client today:
-- assets.edit (updateAssetAction, markQrGeneratedAction, archiveAssetAction),
-- assets.delete (soft delete / restore), assets.dispose (disposeAssetAction
-- under an approval workflow), and handover.assign/transfer/return (custody
-- module completing a handover, transfer, or return — see
-- src/modules/custody/mutations.ts's updateAssetAfterHandover-style call).
-- A single assets.edit-only check would have silently broken every one of
-- those flows for a role that legitimately holds one of the others but not
-- assets.edit (e.g. a Custody Officer role with handover.transfer only).
create or replace function public.current_user_can_write_assets()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    public.current_user_has_permission('assets', 'edit')
    or public.current_user_has_permission('assets', 'delete')
    or public.current_user_has_permission('assets', 'dispose')
    or public.current_user_has_permission('handover', 'assign')
    or public.current_user_has_permission('handover', 'transfer')
    or public.current_user_has_permission('handover', 'return');
$$;

revoke execute on function public.current_user_can_write_assets() from anon, public;
grant execute on function public.current_user_can_write_assets() to authenticated;

drop policy if exists "assets_tenant_isolation" on public.assets;

create policy "assets_tenant_select" on public.assets
  for select
  to authenticated
  using (company_id = public.current_company_id());

create policy "assets_tenant_insert" on public.assets
  for insert
  to authenticated
  with check (
    company_id = public.current_company_id()
    and public.current_user_has_permission('assets', 'create')
  );

create policy "assets_tenant_update" on public.assets
  for update
  to authenticated
  using (company_id = public.current_company_id() and public.current_user_can_write_assets())
  with check (company_id = public.current_company_id() and public.current_user_can_write_assets());

-- Deliberately no DELETE policy for `authenticated` at all — see the
-- no-hard-delete-path note above. `assets_super_admin_bypass` (unchanged,
-- still FOR ALL) is the only way a hard delete can happen, and nothing in
-- the app takes that path today either.
revoke delete on public.assets from anon, authenticated;
