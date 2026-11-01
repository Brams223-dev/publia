-- Publia — Master Plan v1 : offres, quotas serveur, campagnes, profil intelligent

-- ---------------------------------------------------------------------------
-- 1. Offres et limites (modifiables par l'administration)
-- ---------------------------------------------------------------------------
create table public.plan_limits (
  plan text primary key check (plan in ('free','starter','pro','business')),
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  monthly_generations integer not null check (monthly_generations >= 0),
  monthly_video_credits integer not null check (monthly_video_credits >= 0),
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.plan_limits (plan, name, price_cents, monthly_generations, monthly_video_credits, sort_order) values
  ('free', 'Free', 0, 3, 0, 0),
  ('starter', 'Starter', 1990, 30, 0, 1),
  ('pro', 'Pro', 3990, 60, 5, 2),
  ('business', 'Business', 5990, 150, 15, 3);
alter table public.plan_limits enable row level security;
create policy "offres : lecture" on public.plan_limits for select to anon, authenticated using (true);

-- Premium devient Pro ; ajout de Business.
alter table public.subscriptions drop constraint subscriptions_plan_check;
update public.subscriptions set plan = 'pro' where plan = 'premium';
alter table public.subscriptions add constraint subscriptions_plan_check
  check (plan in ('free','starter','pro','business'));

alter table public.usage_logs drop constraint usage_logs_action_check;
alter table public.usage_logs add constraint usage_logs_action_check
  check (action in ('generate_post','generate_youtube','generate_campaign','generate_video','render_thumbnail'));

-- ---------------------------------------------------------------------------
-- 2. Profil intelligent du commerce
-- ---------------------------------------------------------------------------
alter table public.businesses
  add column products text check (char_length(products) <= 2000),
  add column services text check (char_length(services) <= 2000),
  add column target_audience text check (char_length(target_audience) <= 1000),
  add column opening_hours text check (char_length(opening_hours) <= 500),
  add column social_links jsonb not null default '{}'::jsonb,
  add column goals text check (char_length(goals) <= 1000);

-- ---------------------------------------------------------------------------
-- 3. Campagnes (« Fais ma communication »)
-- ---------------------------------------------------------------------------
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  objective text not null check (objective in ('promotion','nouveaute','evenement','nouveaux_clients','fidelisation','saison','notoriete')),
  brief text not null check (char_length(brief) between 5 and 1000),
  facts text check (char_length(facts) <= 1000),
  platforms text[] not null,
  start_date date not null,
  duration_days integer not null check (duration_days in (7, 14)),
  title text,
  summary text,
  strategy text,
  status text not null default 'draft' check (status in ('draft','validated','archived')),
  ai_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index campaigns_business_created_idx on public.campaigns (business_id, created_at desc);
create index campaigns_user_idx on public.campaigns (user_id);
create trigger campaigns_updated_at before update on public.campaigns
  for each row execute function public.set_updated_at();
alter table public.campaigns enable row level security;

alter table public.posts
  add column campaign_id uuid references public.campaigns (id) on delete cascade,
  add column format text check (format in ('post','story','reel','video_courte','short','video')),
  add column scheduled_for date,
  add column visual_idea text;
create index posts_campaign_idx on public.posts (campaign_id, scheduled_for);

-- ---------------------------------------------------------------------------
-- 4. Quotas : consommation atomique, réservée au serveur (service_role)
-- ---------------------------------------------------------------------------
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

  -- Sérialise les demandes d'un même utilisateur (anti double-clic / requêtes parallèles).
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));

  select case when s.status in ('active','trialing') then s.plan else 'free' end into v_plan
  from subscriptions s where s.user_id = p_user;
  v_plan := coalesce(v_plan, 'free');

  select monthly_generations into v_quota from plan_limits where plan = v_plan;
  select coalesce(sum(credits_used), 0) into v_used from usage_logs
  where user_id = p_user
    and action in ('generate_post','generate_youtube','generate_campaign')
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

create or replace function public.refund_generation(p_user uuid, p_key text)
returns void language sql security definer set search_path = public as $$
  delete from usage_logs where user_id = p_user and idempotency_key = p_key;
$$;

revoke execute on function public.consume_generation(uuid, uuid, text, text, integer) from public, anon, authenticated;
revoke execute on function public.refund_generation(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_generation(uuid, uuid, text, text, integer) to service_role;
grant execute on function public.refund_generation(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Politiques RLS optimisées ((select auth.uid()) évalué une seule fois)
-- ---------------------------------------------------------------------------
create or replace function public.owns_business(bid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.businesses b where b.id = bid and b.owner_id = (select auth.uid()));
$$;

create policy "campagnes : lecture" on public.campaigns for select using (public.owns_business(business_id));
create policy "campagnes : création" on public.campaigns for insert
  with check (public.owns_business(business_id) and user_id = (select auth.uid()));
create policy "campagnes : mise à jour" on public.campaigns for update
  using (public.owns_business(business_id)) with check (public.owns_business(business_id));
create policy "campagnes : suppression" on public.campaigns for delete using (public.owns_business(business_id));

-- ---------------------------------------------------------------------------
-- 6. Index des clés étrangères (avis de performance)
-- ---------------------------------------------------------------------------
create index if not exists generation_jobs_post_idx on public.generation_jobs (post_id);
create index if not exists generation_jobs_video_idx on public.generation_jobs (video_id);
create index if not exists posts_template_idx on public.posts (template_id);
create index if not exists social_accounts_user_idx on public.social_accounts (user_id);
create index if not exists usage_logs_business_idx on public.usage_logs (business_id);
create index if not exists video_usage_video_idx on public.video_usage (video_id);
create index if not exists videos_user_idx on public.videos (user_id);
create index if not exists youtube_uploads_business_idx on public.youtube_uploads (business_id);
create index if not exists youtube_uploads_account_idx on public.youtube_uploads (social_account_id);
create index if not exists youtube_uploads_user_idx on public.youtube_uploads (user_id);
