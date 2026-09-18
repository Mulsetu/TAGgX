-- Outbox tracking: lets modules/email/actions.ts find storage_threshold
-- notifications that haven't been emailed yet, without re-sending on
-- every pass. Postgres (check_storage_thresholds, via pg_cron) can only
-- insert the notification row — it has no way to call the Brevo HTTP API
-- itself, so delivery happens from the app side against this column.
alter table public.notifications
  add column emailed_at timestamptz;

create index notifications_unemailed_idx
  on public.notifications (type, emailed_at)
  where emailed_at is null;
