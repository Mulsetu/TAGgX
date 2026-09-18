insert into public.notification_rules (company_id, event_key, offset_days, recipient)
select c.id, x.event_key, x.offset_days, 'admins'
from public.companies c
cross join (
  values
    ('document_expiry', 30),
    ('document_expiry', 7),
    ('document_expiry', 0)
) as x(event_key, offset_days)
on conflict (company_id, event_key, offset_days, recipient) do nothing;
