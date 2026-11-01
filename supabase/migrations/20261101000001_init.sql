-- Publia — schéma initial
-- Toutes les tables exposées au client ont RLS activé.
-- Les écritures sensibles (crédits, abonnements, jobs, jetons) passent uniquement
-- par le serveur avec la clé service_role : aucune politique d'écriture client.


-- ---------------------------------------------------------------------------
-- Utilitaires
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Rôle administrateur : attribué uniquement côté serveur (SQL / service_role).
create table public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  insert into public.subscriptions (user_id, plan, status)
  values (new.id, 'free', 'active');
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- businesses
-- ---------------------------------------------------------------------------
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  category text,
  description text check (char_length(description) <= 2000),
  address text,
  city text,
  phone text,
  website text,
  tone text check (tone in ('professionnel','chaleureux','elegant','dynamique','moderne','humoristique','premium','familial')),
  brand_colors jsonb not null default '{"primary":"#6B55D9","secondary":"#8B78EC","text":"#25243A"}'::jsonb,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index businesses_owner_idx on public.businesses (owner_id);
create trigger businesses_updated_at before update on public.businesses
  for each row execute function public.set_updated_at();

create or replace function public.owns_business(bid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.businesses b where b.id = bid and b.owner_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- brand_assets
-- ---------------------------------------------------------------------------
create table public.brand_assets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  file_path text not null,
  asset_type text not null check (asset_type in ('logo','photo','other')),
  created_at timestamptz not null default now()
);
create index brand_assets_business_idx on public.brand_assets (business_id);

-- ---------------------------------------------------------------------------
-- templates (gérés par l'administration)
-- ---------------------------------------------------------------------------
create table public.templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('promotion','nouveaute','produit','service','evenement','annonce','presentation','tutoriel')),
  format text not null check (format in ('ig_square','ig_portrait','ig_story','fb_square','yt_thumbnail','yt_shorts','yt_classic')),
  layout_config jsonb not null default '{}'::jsonb,
  preview_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index templates_format_idx on public.templates (format) where is_active;

-- ---------------------------------------------------------------------------
-- posts
-- ---------------------------------------------------------------------------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  template_id uuid references public.templates (id) on delete set null,
  title text,
  caption text,
  short_caption text,
  call_to_action text,
  hashtags text[] not null default '{}',
  image_path text,
  rendered_image_path text,
  platform text not null check (platform in ('instagram','tiktok','facebook','youtube')),
  youtube_format text check (youtube_format in ('shorts','classic')),
  keywords text[],
  thumbnail_idea jsonb,
  status text not null default 'draft' check (status in ('draft','ready','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index posts_business_created_idx on public.posts (business_id, created_at desc);
create trigger posts_updated_at before update on public.posts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- videos
-- ---------------------------------------------------------------------------
create table public.videos (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text,
  prompt text,
  source_image_path text,
  video_path text,
  thumbnail_path text,
  format text not null check (format in ('9:16','1:1','16:9')),
  duration integer check (duration > 0),
  platform text not null check (platform in ('instagram','tiktok','facebook','youtube')),
  youtube_format text check (youtube_format in ('shorts','classic')),
  description text,
  hashtags text[] not null default '{}',
  keywords text[],
  call_to_action text,
  thumbnail_idea jsonb,
  subtitles jsonb,
  provider text,
  provider_job_id text,
  status text not null default 'pending' check (status in ('pending','processing','completed','failed','canceled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index videos_business_created_idx on public.videos (business_id, created_at desc);
create unique index videos_provider_job_uidx on public.videos (provider, provider_job_id) where provider_job_id is not null;
create trigger videos_updated_at before update on public.videos
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- subscriptions (écrites uniquement par les webhooks Stripe côté serveur)
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan text not null default 'free' check (plan in ('free','starter','premium')),
  status text not null default 'active' check (status in ('active','trialing','past_due','canceled','incomplete','unpaid')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Consommation et jobs (lecture seule côté client)
-- ---------------------------------------------------------------------------
create table public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete set null,
  action text not null check (action in ('generate_post','generate_youtube','generate_video','render_thumbnail')),
  credits_used integer not null default 1 check (credits_used >= 0),
  provider_cost numeric(10,4),
  idempotency_key text unique,
  created_at timestamptz not null default now()
);
create index usage_logs_user_created_idx on public.usage_logs (user_id, created_at desc);

create table public.video_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  video_id uuid references public.videos (id) on delete set null,
  credits_used integer not null check (credits_used >= 0),
  provider_cost numeric(10,4),
  created_at timestamptz not null default now()
);
create index video_usage_user_idx on public.video_usage (user_id, created_at desc);

create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  post_id uuid references public.posts (id) on delete cascade,
  video_id uuid references public.videos (id) on delete cascade,
  provider text not null,
  provider_job_id text,
  status text not null default 'pending' check (status in ('pending','processing','completed','failed','canceled')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index generation_jobs_user_idx on public.generation_jobs (user_id, created_at desc);
create index generation_jobs_active_idx on public.generation_jobs (status) where status in ('pending','processing');
create trigger generation_jobs_updated_at before update on public.generation_jobs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Comptes sociaux (phase 9) — jetons chiffrés, jamais lisibles par le client
-- ---------------------------------------------------------------------------
create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  platform text not null check (platform in ('instagram','tiktok','facebook','youtube')),
  external_account_id text,
  account_name text,
  encrypted_credentials text,
  token_expires_at timestamptz,
  connection_status text not null default 'disconnected' check (connection_status in ('disconnected','connected','expired','error')),
  created_at timestamptz not null default now(),
  unique (business_id, platform, external_account_id)
);

create table public.youtube_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  social_account_id uuid not null references public.social_accounts (id) on delete cascade,
  youtube_video_id text,
  upload_session_uri text,
  privacy_status text not null default 'private' check (privacy_status in ('private','unlisted','public')),
  status text not null default 'queued' check (status in ('queued','uploading','processing','published','failed')),
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Un seul upload actif par vidéo et par chaîne.
create unique index youtube_uploads_active_uidx on public.youtube_uploads (video_id, social_account_id)
  where status in ('queued','uploading','processing');
create trigger youtube_uploads_updated_at before update on public.youtube_uploads
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.app_admins enable row level security;
alter table public.businesses enable row level security;
alter table public.brand_assets enable row level security;
alter table public.templates enable row level security;
alter table public.posts enable row level security;
alter table public.videos enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_logs enable row level security;
alter table public.video_usage enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.social_accounts enable row level security;
alter table public.youtube_uploads enable row level security;
-- app_admins : aucune politique → invisible pour le client.

create policy "profil : lecture" on public.profiles for select using (id = auth.uid());
create policy "profil : mise à jour" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "commerce : lecture" on public.businesses for select using (owner_id = auth.uid());
create policy "commerce : création" on public.businesses for insert with check (owner_id = auth.uid());
create policy "commerce : mise à jour" on public.businesses for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "commerce : suppression" on public.businesses for delete using (owner_id = auth.uid());

create policy "assets : tout" on public.brand_assets for all
  using (public.owns_business(business_id)) with check (public.owns_business(business_id));

create policy "modèles : lecture des actifs" on public.templates for select
  using (is_active and auth.role() = 'authenticated');

create policy "posts : tout" on public.posts for all
  using (public.owns_business(business_id)) with check (public.owns_business(business_id));

-- Vidéos : le client lit et édite l'habillage ; la création et les statuts passent par le serveur.
create policy "vidéos : lecture" on public.videos for select using (public.owns_business(business_id));
create policy "vidéos : suppression" on public.videos for delete using (public.owns_business(business_id));

create policy "abonnement : lecture" on public.subscriptions for select using (user_id = auth.uid());
create policy "conso : lecture" on public.usage_logs for select using (user_id = auth.uid());
create policy "conso vidéo : lecture" on public.video_usage for select using (user_id = auth.uid());
create policy "jobs : lecture" on public.generation_jobs for select using (user_id = auth.uid());
create policy "uploads youtube : lecture" on public.youtube_uploads for select using (user_id = auth.uid());

create policy "comptes sociaux : lecture" on public.social_accounts for select using (user_id = auth.uid());
-- Les jetons chiffrés ne sont jamais lisibles par le client, même sur ses propres lignes.
revoke select on public.social_accounts from anon, authenticated;
grant select (id, user_id, business_id, platform, external_account_id, account_name,
              token_expires_at, connection_status, created_at)
  on public.social_accounts to authenticated;

-- ---------------------------------------------------------------------------
-- Stockage : buckets privés, premier dossier = business_id du propriétaire
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('brand-assets', 'brand-assets', false, 5242880, array['image/png','image/jpeg','image/webp','image/svg+xml']),
  ('uploads', 'uploads', false, 15728640, array['image/png','image/jpeg','image/webp','image/heic']),
  ('renders', 'renders', false, 524288000, array['image/png','image/jpeg','video/mp4','text/plain'])
on conflict (id) do nothing;

create policy "stockage : lecture propriétaire" on storage.objects for select
  using (bucket_id in ('brand-assets','uploads','renders')
         and public.owns_business(((storage.foldername(name))[1])::uuid));
create policy "stockage : dépôt propriétaire" on storage.objects for insert
  with check (bucket_id in ('brand-assets','uploads')
              and public.owns_business(((storage.foldername(name))[1])::uuid));
create policy "stockage : remplacement propriétaire" on storage.objects for update
  using (bucket_id in ('brand-assets','uploads')
         and public.owns_business(((storage.foldername(name))[1])::uuid));
create policy "stockage : suppression propriétaire" on storage.objects for delete
  using (bucket_id in ('brand-assets','uploads','renders')
         and public.owns_business(((storage.foldername(name))[1])::uuid));
-- Le bucket « renders » n'est écrit que par le serveur (vidéos et visuels finaux).
