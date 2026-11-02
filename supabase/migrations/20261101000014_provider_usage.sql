-- Phase 0.4 — Suivi des coûts réels par fournisseur, séparés par catégorie.
--
-- Chaque appel à un fournisseur externe est enregistré avec ses unités réellement consommées
-- (jetons, images, secondes…). Le coût n'est calculé que si un tarif a été saisi dans
-- provider_prices : aucun prix n'est supposé ni inventé.
-- Catégories séparées (Master Plan §9) : IA, frais de paiement, budget publicitaire,
-- livraison, nom de domaine, autre. L'abonnement Publia est suivi à part (Stripe).

create table public.provider_prices (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (char_length(provider) <= 40),
  model text not null check (char_length(model) <= 100),
  unit text not null check (unit in ('input_token', 'output_token', 'cached_input_token', 'image', 'second', 'request')),
  -- Prix d'une unité en millionièmes de la devise (ex. 2,50 $ le million de jetons = 2.5 micro-unités par jeton).
  price_micros numeric(14, 6) not null check (price_micros >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  valid_from date not null default current_date,
  source_url text,
  note text,
  created_at timestamptz not null default now(),
  unique (provider, model, unit, valid_from)
);
alter table public.provider_prices enable row level security;
revoke all on public.provider_prices from anon, authenticated;

create table public.provider_usage (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  category text not null default 'ai' check (category in ('ai', 'payment_fees', 'ad_spend', 'shipping', 'domain', 'other')),
  provider text not null check (char_length(provider) <= 40),
  model text check (char_length(model) <= 100),
  operation text not null check (char_length(operation) <= 60),
  status text not null default 'ok' check (status in ('ok', 'error')),
  organization_id uuid references public.organizations (id) on delete set null,
  business_id uuid references public.businesses (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  cached_input_tokens integer not null default 0 check (cached_input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  images integer not null default 0 check (images >= 0),
  seconds numeric(10, 2) not null default 0 check (seconds >= 0),
  -- Montant connu directement (frais Stripe, dépense publicitaire facturée…), en centimes.
  amount_cents bigint check (amount_cents >= 0),
  currency text check (currency ~ '^[A-Z]{3}$'),
  duration_ms integer check (duration_ms >= 0),
  request_id text check (char_length(request_id) <= 120)
);
create index provider_usage_created_idx on public.provider_usage (created_at desc);
create index provider_usage_org_idx on public.provider_usage (organization_id, created_at desc);
create index provider_usage_business_idx on public.provider_usage (business_id);
create index provider_usage_user_idx on public.provider_usage (user_id);
alter table public.provider_usage enable row level security;
revoke all on public.provider_usage from anon, authenticated;

-- Coût calculé d'une ligne d'usage, au tarif en vigueur à sa date ; null si un tarif manque.
create or replace function public.usage_cost_micros(u public.provider_usage)
returns numeric language sql stable set search_path = public as $$
  with p as (
    select distinct on (unit) unit, price_micros, currency
    from provider_prices
    where provider = u.provider and model = u.model and valid_from <= u.created_at::date
    order by unit, valid_from desc
  ),
  need as (
    select 'input_token' unit, (u.input_tokens - u.cached_input_tokens)::numeric qty where u.input_tokens - u.cached_input_tokens > 0
    union all select 'cached_input_token', u.cached_input_tokens where u.cached_input_tokens > 0
    union all select 'output_token', u.output_tokens where u.output_tokens > 0
    union all select 'image', u.images where u.images > 0
    union all select 'second', u.seconds where u.seconds > 0
  )
  select case
    when u.category <> 'ai' then null
    when exists (select 1 from need n where not exists (select 1 from p where p.unit = n.unit)) then null
    else coalesce((select sum(n.qty * p.price_micros) from need n join p on p.unit = n.unit), 0)
         + coalesce((select price_micros from p where unit = 'request'), 0)
  end;
$$;
revoke execute on function public.usage_cost_micros(public.provider_usage) from public, anon, authenticated;

-- Synthèse mensuelle pour l'administration (lue avec la clé serveur uniquement).
create or replace view public.provider_usage_monthly with (security_invoker = true) as
select
  date_trunc('month', u.created_at)::date as month,
  u.category, u.provider, u.model, u.operation,
  count(*) as calls,
  count(*) filter (where u.status = 'error') as errors,
  sum(u.input_tokens) as input_tokens,
  sum(u.output_tokens) as output_tokens,
  sum(u.images) as images,
  sum(u.seconds) as seconds,
  sum(u.amount_cents) as amount_cents,
  sum(public.usage_cost_micros(u)) / 1e6 as computed_cost,
  count(*) filter (where u.category = 'ai' and public.usage_cost_micros(u) is null) as unpriced_calls,
  (select string_agg(distinct p.currency, ',') from provider_prices p where p.provider = u.provider and p.model = u.model) as price_currency
from public.provider_usage u
group by 1, 2, 3, 4, 5;
revoke all on public.provider_usage_monthly from anon, authenticated;

-- Indique au serveur si l'utilisateur est administrateur de la plateforme.
create or replace function public.is_app_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_admins where user_id = (select auth.uid()));
$$;
revoke execute on function public.is_app_admin() from public, anon;
grant execute on function public.is_app_admin() to authenticated;
