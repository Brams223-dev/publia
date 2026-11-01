-- Journal des erreurs applicatives (serveur et navigateur).
-- Écrit uniquement par le serveur (clé service) ; aucune lecture côté utilisateur.
-- Aucune donnée sensible : messages tronqués, jamais de corps de requête, de jeton ni de clé.
create table public.app_errors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  source text not null check (source in ('server', 'action', 'client')),
  route text check (char_length(route) <= 300),
  message text not null check (char_length(message) <= 1000),
  digest text check (char_length(digest) <= 100),
  user_id uuid references auth.users (id) on delete set null,
  context jsonb not null default '{}'::jsonb
);
create index app_errors_created_idx on public.app_errors (created_at desc);
create index app_errors_user_idx on public.app_errors (user_id);
alter table public.app_errors enable row level security;
revoke all on public.app_errors from anon, authenticated;
