-- Publia Commerce : trace des vérifications de conformité confirmées par le commerçant
-- ({ level, reasons[], checklist[], confirmed_at, country }).
alter table public.products add column compliance jsonb not null default '{}'::jsonb;
