-- Internationalisation progressive : prix et taxes par marché, réglages pays du commerce.
-- Seule la France est active. Aucun autre marché n'est créé tant qu'il n'a pas été vérifié.

-- Prix des offres par marché (source pour la page tarifs et, plus tard, le paiement).
create table public.plan_prices (
  plan text not null references public.plan_limits (plan) on delete cascade,
  market_code text not null check (market_code ~ '^[A-Z]{2}$'),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount_cents integer not null check (amount_cents >= 0),
  tax_inclusive boolean not null default true,
  interval text not null default 'month' check (interval in ('month','year')),
  provider_price_id text,            -- identifiant du prix chez le fournisseur de paiement (à renseigner)
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (plan, market_code, interval)
);
insert into public.plan_prices (plan, market_code, currency, amount_cents, tax_inclusive) values
  ('free', 'FR', 'EUR', 0, true),
  ('starter', 'FR', 'EUR', 1990, true),
  ('pro', 'FR', 'EUR', 3990, true),
  ('business', 'FR', 'EUR', 5990, true);
alter table public.plan_prices enable row level security;
create policy "prix : lecture" on public.plan_prices for select to anon, authenticated using (active);

-- Taux de taxe par marché (en points de base : 2000 = 20 %).
create table public.tax_rates (
  id uuid primary key default gen_random_uuid(),
  market_code text not null check (market_code ~ '^[A-Z]{2}$'),
  label text not null,
  rate_bp integer not null check (rate_bp between 0 and 10000),
  applies_to text not null default 'subscription' check (applies_to in ('subscription','credits')),
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to > effective_from)
);
create index tax_rates_market_idx on public.tax_rates (market_code, effective_from desc);
insert into public.tax_rates (market_code, label, rate_bp, applies_to, effective_from) values
  ('FR', 'TVA', 2000, 'subscription', '2014-01-01'),
  ('FR', 'TVA', 2000, 'credits', '2014-01-01');
alter table public.tax_rates enable row level security;
create policy "taxes : lecture" on public.tax_rates for select to authenticated using (true);

-- Réglages de marché du commerce (locataire). Valeurs par défaut : France.
alter table public.businesses
  add column country_code text not null default 'FR' check (country_code ~ '^[A-Z]{2}$'),
  add column locale text not null default 'fr' check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  add column currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  add column timezone text not null default 'Europe/Paris' check (char_length(timezone) between 3 and 64);
