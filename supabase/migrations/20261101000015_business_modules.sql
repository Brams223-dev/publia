-- Publia Business — Contacts, Inbox, Avis, Fidélité, Mini-site.
-- Aucune dépendance externe. Données personnelles des clients : consentement marketing
-- explicite et daté (RGPD), jamais présumé.

-- ---------------------------------------------------------------------------
-- Contacts
-- ---------------------------------------------------------------------------
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  first_name text check (char_length(first_name) <= 80),
  last_name text check (char_length(last_name) <= 80),
  email text check (email is null or (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254)),
  phone text check (char_length(phone) <= 30),
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  notes text check (char_length(notes) <= 2000),
  source text not null default 'manual' check (source in ('manual', 'import', 'minisite', 'review', 'loyalty')),
  marketing_consent boolean not null default false,
  consent_at timestamptz,
  consent_source text check (char_length(consent_source) <= 120),
  last_interaction_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (coalesce(first_name, last_name, email, phone) is not null),
  check (not marketing_consent or consent_at is not null)
);
create unique index contacts_email_uidx on public.contacts (business_id, lower(email)) where email is not null;
create index contacts_business_idx on public.contacts (business_id, created_at desc);
create index contacts_tags_gin on public.contacts using gin (tags);
create trigger contacts_updated_at before update on public.contacts for each row execute function public.set_updated_at();
alter table public.contacts enable row level security;
create policy "contacts : tout" on public.contacts for all using (public.owns_business(business_id)) with check (public.owns_business(business_id));

-- ---------------------------------------------------------------------------
-- Inbox (messages reçus via le formulaire du mini-site)
-- ---------------------------------------------------------------------------
create table public.inbox_messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  email text check (email is null or (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254)),
  phone text check (char_length(phone) <= 30),
  subject text check (char_length(subject) <= 150),
  body text not null check (char_length(body) between 1 and 3000),
  source text not null default 'minisite' check (source in ('minisite')),
  status text not null default 'new' check (status in ('new', 'read', 'archived')),
  created_at timestamptz not null default now(),
  check (email is not null or phone is not null)
);
create index inbox_messages_business_idx on public.inbox_messages (business_id, created_at desc);
create index inbox_messages_contact_idx on public.inbox_messages (contact_id);
alter table public.inbox_messages enable row level security;
create policy "inbox : lecture" on public.inbox_messages for select using (public.owns_business(business_id));
create policy "inbox : mise à jour" on public.inbox_messages for update using (public.owns_business(business_id)) with check (public.owns_business(business_id));
create policy "inbox : suppression" on public.inbox_messages for delete using (public.owns_business(business_id));
-- Création uniquement par le serveur (formulaire public contrôlé).
revoke insert on public.inbox_messages from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Avis clients (déposés par les clients, modérés par le commerçant)
-- ---------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  author_name text not null check (char_length(author_name) between 1 and 80),
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 2000),
  status text not null default 'pending' check (status in ('pending', 'published', 'hidden')),
  reply text check (char_length(reply) <= 1000),
  replied_at timestamptz,
  source text not null default 'minisite' check (source in ('minisite')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reviews_business_idx on public.reviews (business_id, created_at desc);
create index reviews_contact_idx on public.reviews (contact_id);
create trigger reviews_updated_at before update on public.reviews for each row execute function public.set_updated_at();
alter table public.reviews enable row level security;
create policy "avis : lecture" on public.reviews for select using (public.owns_business(business_id));
-- Le commerçant modère et répond, mais ne modifie jamais la note ni le texte du client.
create policy "avis : modération" on public.reviews for update using (public.owns_business(business_id)) with check (public.owns_business(business_id));
-- Pas de suppression par le commerçant : un avis ne peut qu'être masqué (motif légitime), et cela reste tracé.
revoke insert, delete on public.reviews from anon, authenticated;
revoke update on public.reviews from authenticated;
grant update (status, reply, replied_at) on public.reviews to authenticated;

-- ---------------------------------------------------------------------------
-- Fidélité
-- ---------------------------------------------------------------------------
create table public.loyalty_programs (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  active boolean not null default true,
  kind text not null default 'stamps' check (kind in ('stamps', 'points')),
  -- Tampons : nombre de passages pour une récompense. Points : points gagnés par euro dépensé.
  stamps_required integer not null default 10 check (stamps_required between 2 and 50),
  points_per_euro numeric(6, 2) not null default 1 check (points_per_euro > 0 and points_per_euro <= 100),
  reward_threshold integer not null default 100 check (reward_threshold between 1 and 100000),
  reward_label text not null default 'Une récompense offerte' check (char_length(reward_label) between 1 and 120),
  terms text check (char_length(terms) <= 1000),
  updated_at timestamptz not null default now()
);
create trigger loyalty_programs_updated_at before update on public.loyalty_programs for each row execute function public.set_updated_at();
alter table public.loyalty_programs enable row level security;
create policy "fidélité programme : tout" on public.loyalty_programs for all using (public.owns_business(business_id)) with check (public.owns_business(business_id));

create table public.loyalty_cards (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  -- Code de consultation de la carte par le client (aléatoire, non devinable, révocable).
  public_code text not null unique default replace(gen_random_uuid()::text, '-', '') check (char_length(public_code) between 16 and 64),
  balance integer not null default 0 check (balance >= 0),
  total_earned integer not null default 0 check (total_earned >= 0),
  rewards_redeemed integer not null default 0 check (rewards_redeemed >= 0),
  created_at timestamptz not null default now(),
  unique (business_id, contact_id)
);
create index loyalty_cards_contact_idx on public.loyalty_cards (contact_id);
alter table public.loyalty_cards enable row level security;
create policy "cartes : lecture" on public.loyalty_cards for select using (public.owns_business(business_id));
create policy "cartes : suppression" on public.loyalty_cards for delete using (public.owns_business(business_id));
-- Les soldes ne changent que par loyalty_apply (historique garanti).
revoke insert, update on public.loyalty_cards from anon, authenticated;

create table public.loyalty_events (
  id bigint generated always as identity primary key,
  card_id uuid not null references public.loyalty_cards (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  kind text not null check (kind in ('earn', 'redeem', 'adjust')),
  amount integer not null,
  spend_cents integer check (spend_cents >= 0),
  note text check (char_length(note) <= 200),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index loyalty_events_card_idx on public.loyalty_events (card_id, created_at desc);
create index loyalty_events_business_idx on public.loyalty_events (business_id);
create index loyalty_events_created_by_idx on public.loyalty_events (created_by);
alter table public.loyalty_events enable row level security;
create policy "fidélité historique : lecture" on public.loyalty_events for select using (public.owns_business(business_id));
revoke insert, update, delete on public.loyalty_events from anon, authenticated;

create or replace function public.loyalty_create_card(p_contact uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_business uuid; v_id uuid;
begin
  select business_id into v_business from contacts where id = p_contact;
  if v_business is null or not public.owns_business(v_business) then raise exception 'forbidden'; end if;
  insert into loyalty_cards (business_id, contact_id) values (v_business, p_contact)
  on conflict (business_id, contact_id) do update set business_id = excluded.business_id
  returning id into v_id;
  return v_id;
end $$;

-- Ajoute des tampons/points ou utilise une récompense, avec historique, de façon atomique.
create or replace function public.loyalty_apply(p_card uuid, p_kind text, p_amount integer, p_spend_cents integer, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c loyalty_cards%rowtype; p loyalty_programs%rowtype; v_amount integer; v_cost integer;
begin
  select * into c from loyalty_cards where id = p_card for update;
  if not found or not public.owns_business(c.business_id) then raise exception 'forbidden'; end if;
  select * into p from loyalty_programs where business_id = c.business_id;
  if not found or not p.active then raise exception 'program_inactive'; end if;
  v_cost := case p.kind when 'stamps' then p.stamps_required else p.reward_threshold end;

  if p_kind = 'earn' then
    if p.kind = 'stamps' then
      v_amount := coalesce(p_amount, 1);
      if v_amount < 1 or v_amount > 10 then raise exception 'invalid_amount'; end if;
    else
      if p_spend_cents is null or p_spend_cents < 1 or p_spend_cents > 10000000 then raise exception 'invalid_amount'; end if;
      v_amount := floor(p_spend_cents / 100.0 * p.points_per_euro);
      if v_amount < 1 then raise exception 'invalid_amount'; end if;
    end if;
    update loyalty_cards set balance = balance + v_amount, total_earned = total_earned + v_amount where id = c.id;
  elsif p_kind = 'redeem' then
    if c.balance < v_cost then raise exception 'insufficient_balance'; end if;
    v_amount := -v_cost;
    update loyalty_cards set balance = balance - v_cost, rewards_redeemed = rewards_redeemed + 1 where id = c.id;
  elsif p_kind = 'adjust' then
    v_amount := coalesce(p_amount, 0);
    if v_amount = 0 or c.balance + v_amount < 0 or abs(v_amount) > 100000 then raise exception 'invalid_amount'; end if;
    if p_note is null or char_length(trim(p_note)) < 3 then raise exception 'note_required'; end if;
    update loyalty_cards set balance = balance + v_amount where id = c.id;
  else
    raise exception 'invalid_kind';
  end if;

  insert into loyalty_events (card_id, business_id, kind, amount, spend_cents, note, created_by)
  values (c.id, c.business_id, p_kind, v_amount, case when p_kind = 'earn' then p_spend_cents end, nullif(left(trim(coalesce(p_note, '')), 200), ''), auth.uid());
  update contacts set last_interaction_at = now() where id = c.contact_id;
  return (select jsonb_build_object('balance', balance, 'total_earned', total_earned, 'rewards_redeemed', rewards_redeemed) from loyalty_cards where id = c.id);
end $$;

-- Nouveau code de consultation (l'ancien lien cesse de fonctionner).
create or replace function public.loyalty_rotate_code(p_card uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text := replace(gen_random_uuid()::text, '-', '');
begin
  update loyalty_cards set public_code = v_code where id = p_card and public.owns_business(business_id);
  if not found then raise exception 'forbidden'; end if;
  return v_code;
end $$;

revoke execute on function public.loyalty_create_card(uuid), public.loyalty_apply(uuid, text, integer, integer, text), public.loyalty_rotate_code(uuid) from public, anon;
grant execute on function public.loyalty_create_card(uuid), public.loyalty_apply(uuid, text, integer, integer, text), public.loyalty_rotate_code(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Limites de débit des formulaires publics (par empreinte d'adresse IP, côté serveur)
-- ---------------------------------------------------------------------------
create table public.public_rate_limits (
  key text not null check (char_length(key) <= 100),
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);
alter table public.public_rate_limits enable row level security;
revoke all on public.public_rate_limits from anon, authenticated;

create or replace function public.public_rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_start timestamptz; v_hits integer;
begin
  v_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public_rate_limits (key, window_start, hits) values (left(p_key, 100), v_start, 1)
  on conflict (key, window_start) do update set hits = public_rate_limits.hits + 1
  returning hits into v_hits;
  if random() < 0.01 then delete from public_rate_limits where window_start < now() - interval '2 days'; end if;
  return v_hits <= p_limit;
end $$;
revoke execute on function public.public_rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.public_rate_limit_hit(text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Journal d'audit : suppression de contacts et changements de modération
-- ---------------------------------------------------------------------------
create or replace function public.audit_business_modules()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'contacts' and tg_op = 'DELETE' then
    perform audit_write(org_of_business(old.business_id), old.business_id, 'contact.deleted', 'contact', old.id::text,
      jsonb_build_object('name', trim(coalesce(old.first_name, '') || ' ' || coalesce(old.last_name, ''))));
  elsif tg_table_name = 'reviews' and tg_op = 'UPDATE' and new.status is distinct from old.status then
    perform audit_write(org_of_business(new.business_id), new.business_id, 'review.' || new.status, 'review', new.id::text,
      jsonb_build_object('author', new.author_name, 'rating', new.rating));
  elsif tg_table_name = 'reviews' and tg_op = 'DELETE' then
    perform audit_write(org_of_business(old.business_id), old.business_id, 'review.deleted', 'review', old.id::text,
      jsonb_build_object('author', old.author_name, 'rating', old.rating));
  elsif tg_table_name = 'shops' and tg_op = 'UPDATE' and new.published is distinct from old.published then
    perform audit_write(org_of_business(new.business_id), new.business_id, case when new.published then 'minisite.published' else 'minisite.unpublished' end, 'shop', new.business_id::text,
      jsonb_build_object('slug', new.slug));
  end if;
  return coalesce(new, old);
end $$;
revoke execute on function public.audit_business_modules() from public, anon, authenticated;
create trigger audit_contacts after delete on public.contacts for each row execute function public.audit_business_modules();
create trigger audit_reviews after update or delete on public.reviews for each row execute function public.audit_business_modules();
create trigger audit_shops after update on public.shops for each row execute function public.audit_business_modules();
