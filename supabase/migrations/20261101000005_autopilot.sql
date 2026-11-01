-- Publia Autopilot : programmation, règles hebdomadaires, historique de diffusion,
-- et coûts en crédits par type d'opération (Fashion AI, vidéo…).

-- ---------------------------------------------------------------------------
-- 1. Programmation des contenus
-- ---------------------------------------------------------------------------
alter table public.posts
  add column scheduled_at timestamptz,
  add column publish_status text not null default 'unscheduled'
    check (publish_status in ('unscheduled','scheduled','paused','published','canceled','failed')),
  add column published_at timestamptz,
  add column publish_error text,
  add column publish_attempts integer not null default 0 check (publish_attempts >= 0),
  add column social_account_id uuid references public.social_accounts (id) on delete set null,
  add column external_post_id text;
create index posts_schedule_idx on public.posts (business_id, scheduled_at) where scheduled_at is not null;
create index posts_social_account_idx on public.posts (social_account_id);
-- File d'attente du futur moteur de publication (contenus arrivés à échéance).
create index posts_due_idx on public.posts (scheduled_at) where publish_status = 'scheduled';

-- ---------------------------------------------------------------------------
-- 2. Réglages Autopilot (un par commerce)
-- rules : [{ "platform": "instagram", "days": [1,3,5], "time": "18:30" }], days ISO 1 = lundi
-- ---------------------------------------------------------------------------
create table public.autopilot_settings (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  enabled boolean not null default false,
  timezone text not null default 'Europe/Paris',
  weeks_ahead integer not null default 2 check (weeks_ahead between 1 and 8),
  rules jsonb not null default '[]'::jsonb check (jsonb_typeof(rules) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger autopilot_settings_updated_at before update on public.autopilot_settings
  for each row execute function public.set_updated_at();
alter table public.autopilot_settings enable row level security;
create policy "autopilot : tout" on public.autopilot_settings for all
  using (public.owns_business(business_id)) with check (public.owns_business(business_id));

-- ---------------------------------------------------------------------------
-- 3. Historique de diffusion
-- ---------------------------------------------------------------------------
create table public.publish_events (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  event text not null check (event in ('scheduled','rescheduled','paused','resumed','canceled','published_manual','published','failed')),
  detail text check (char_length(detail) <= 500),
  scheduled_at timestamptz,
  created_at timestamptz not null default now()
);
create index publish_events_business_idx on public.publish_events (business_id, created_at desc);
create index publish_events_post_idx on public.publish_events (post_id);
alter table public.publish_events enable row level security;
create policy "historique : lecture" on public.publish_events for select using (public.owns_business(business_id));
create policy "historique : ajout" on public.publish_events for insert with check (public.owns_business(business_id));

-- ---------------------------------------------------------------------------
-- 4. Coûts en crédits par opération (affichés avant chaque génération)
-- Valeurs provisoires : à calibrer selon les tarifs réels des fournisseurs.
-- ---------------------------------------------------------------------------
create table public.credit_costs (
  operation text primary key,
  label text not null,
  credits integer not null check (credits >= 0),
  provider text,
  active boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.credit_costs (operation, label, credits, provider, active) values
  ('generate_campaign', 'Campagne « Fais ma communication »', 1, 'openai', true),
  ('image_generation', 'Génération d''image', 1, null, false),
  ('background_removal', 'Détourage et amélioration photo', 1, null, false),
  ('virtual_tryon', 'Essayage virtuel', 3, null, false),
  ('video_generation', 'Génération vidéo', 10, null, false),
  ('avatar_creation', 'Création d''avatar', 20, null, false);
alter table public.credit_costs enable row level security;
create policy "coûts : lecture" on public.credit_costs for select to authenticated using (true);

alter table public.usage_logs drop constraint usage_logs_action_check;
alter table public.usage_logs add constraint usage_logs_action_check check (action in (
  'generate_post','generate_youtube','generate_campaign','generate_video','render_thumbnail',
  'image_generation','background_removal','virtual_tryon','video_generation','avatar_creation'));
