-- An audit exception can raise a maintenance ticket ("Raise ticket" on the
-- audit page). The link lets the audit show "Ticket raised" and stops the
-- same exception from raising duplicates. audit_items already has RLS
-- (audit_items_tenant_isolation, migration 0029) and no column-level
-- grants, so no policy change is needed.
alter table public.audit_items
  add column if not exists maintenance_ticket_id uuid
    references public.maintenance_tickets (id) on delete set null;

create index if not exists audit_items_maintenance_ticket_id_idx
  on public.audit_items (maintenance_ticket_id)
  where maintenance_ticket_id is not null;
