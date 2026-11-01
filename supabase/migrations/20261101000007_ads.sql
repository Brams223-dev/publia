-- Publia Ads — V1 : campagnes publicitaires en brouillon, variantes créatives, historique.
-- Aucune diffusion réelle tant qu'un compte publicitaire officiel n'est pas connecté.

create table public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('meta','tiktok','google','youtube')),
  objective text not null,
  name text not null check (char_length(name) between 1 and 120),
  offer text not null check (char_length(offer) between 5 and 800),
  facts text check (char_length(facts) <= 800),
  creation_id uuid references public.creations (id) on delete set null,
  landing_url text check (char_length(landing_url) <= 300),
  geo jsonb not null default '{}'::jsonb,        -- { city, radius_km }
  audience jsonb not null default '{}'::jsonb,   -- { age_min, age_max, interests[], rationale }
  daily_budget_cents integer not null check (daily_budget_cents between 100 and 100000),
  spend_cap_cents integer not null check (spend_cap_cents >= 100),
  start_date date not null,
  end_date date not null,
  status text not null default 'draft' check (status in ('draft','ready','pending_launch','active','paused','completed','archived')),
  external_campaign_id text,
  ai_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index ad_campaigns_business_idx on public.ad_campaigns (business_id, created_at desc);
create index ad_campaigns_user_idx on public.ad_campaigns (user_id);
create index ad_campaigns_creation_idx on public.ad_campaigns (creation_id);
create trigger ad_campaigns_updated_at before update on public.ad_campaigns
  for each row execute function public.set_updated_at();
alter table public.ad_campaigns enable row level security;
create policy "ads : lecture" on public.ad_campaigns for select using (public.owns_business(business_id));
create policy "ads : création" on public.ad_campaigns for insert with check (public.owns_business(business_id) and user_id = (select auth.uid()));
create policy "ads : mise à jour" on public.ad_campaigns for update using (public.owns_business(business_id)) with check (public.owns_business(business_id));
create policy "ads : suppression" on public.ad_campaigns for delete using (public.owns_business(business_id));

create table public.ad_variants (
  id uuid primary key default gen_random_uuid(),
  ad_campaign_id uuid not null references public.ad_campaigns (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  angle text check (char_length(angle) <= 120),
  headline text not null check (char_length(headline) <= 120),
  primary_text text not null check (char_length(primary_text) <= 1000),
  description text check (char_length(description) <= 200),
  cta text not null check (char_length(cta) <= 40),
  selected boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ad_variants_campaign_idx on public.ad_variants (ad_campaign_id, sort_order);
create index ad_variants_business_idx on public.ad_variants (business_id);
create trigger ad_variants_updated_at before update on public.ad_variants
  for each row execute function public.set_updated_at();
alter table public.ad_variants enable row level security;
create policy "variantes : tout" on public.ad_variants for all
  using (public.owns_business(business_id)) with check (public.owns_business(business_id));

create table public.ad_events (
  id uuid primary key default gen_random_uuid(),
  ad_campaign_id uuid not null references public.ad_campaigns (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  event text not null check (event in ('created','variants_generated','edited','validated','launch_requested','launched','paused','resumed','budget_changed','archived')),
  detail text check (char_length(detail) <= 500),
  created_at timestamptz not null default now()
);
create index ad_events_campaign_idx on public.ad_events (ad_campaign_id, created_at desc);
create index ad_events_business_idx on public.ad_events (business_id);
alter table public.ad_events enable row level security;
create policy "historique ads : lecture" on public.ad_events for select using (public.owns_business(business_id));
create policy "historique ads : ajout" on public.ad_events for insert with check (public.owns_business(business_id));

-- Crédit de génération pour les créations publicitaires.
alter table public.usage_logs drop constraint usage_logs_action_check;
alter table public.usage_logs add constraint usage_logs_action_check check (action in (
  'generate_post','generate_youtube','generate_campaign','generate_ads','generate_video','render_thumbnail',
  'image_generation','background_removal','virtual_tryon','video_generation','avatar_creation'));

create or replace function public.consume_generation(p_user uuid, p_business uuid, p_action text, p_key text, p_credits integer default 1)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_plan text;
  v_quota integer;
  v_used integer;
begin
  if not exists (select 1 from businesses where id = p_business and owner_id = p_user) then
    return jsonb_build_object('ok', false, 'reason', 'business');
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  select case when s.status in ('active','trialing') then s.plan else 'free' end into v_plan
  from subscriptions s where s.user_id = p_user;
  v_plan := coalesce(v_plan, 'free');
  select monthly_generations into v_quota from plan_limits where plan = v_plan;
  select coalesce(sum(credits_used), 0) into v_used from usage_logs
  where user_id = p_user
    and action in ('generate_post','generate_youtube','generate_campaign','generate_ads')
    and created_at >= date_trunc('month', now());
  if v_used + p_credits > coalesce(v_quota, 0) then
    return jsonb_build_object('ok', false, 'reason', 'quota', 'used', v_used, 'quota', v_quota, 'plan', v_plan);
  end if;
  insert into usage_logs (user_id, business_id, action, credits_used, idempotency_key)
  values (p_user, p_business, p_action, p_credits, p_key);
  return jsonb_build_object('ok', true, 'used', v_used + p_credits, 'quota', v_quota, 'plan', v_plan);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'reason', 'duplicate');
end $$;
revoke execute on function public.consume_generation(uuid, uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.consume_generation(uuid, uuid, text, text, integer) to service_role;

insert into public.credit_costs (operation, label, credits, provider, active)
values ('generate_ads', 'Créations publicitaires (Ads Factory)', 1, 'openai', true)
on conflict (operation) do nothing;
