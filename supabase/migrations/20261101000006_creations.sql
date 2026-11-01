-- Studio créatif + Bibliothèque : visuels générés par le moteur de composition (sans IA générative).
create table public.creations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  post_id uuid references public.posts (id) on delete set null,
  kind text not null default 'visual' check (kind in ('visual','thumbnail','video')),
  format text not null check (format in ('ig_square','ig_portrait','ig_story','fb_square','yt_thumbnail','yt_shorts','yt_classic')),
  template_id text,
  title text check (char_length(title) <= 200),
  file_path text not null,
  mime_type text not null default 'image/png' check (mime_type in ('image/png','image/jpeg','video/mp4')),
  width integer,
  height integer,
  params jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index creations_business_created_idx on public.creations (business_id, created_at desc);
create index creations_post_idx on public.creations (post_id);
alter table public.creations enable row level security;
create policy "créations : lecture" on public.creations for select using (public.owns_business(business_id));
create policy "créations : ajout" on public.creations for insert with check (public.owns_business(business_id));
create policy "créations : suppression" on public.creations for delete using (public.owns_business(business_id));
