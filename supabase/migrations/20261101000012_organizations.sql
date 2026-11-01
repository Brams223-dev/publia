-- Phase 0.2 — Organisations, commerces multiples, équipe et rôles.
--
-- Modèle : une organisation possède un ou plusieurs commerces et des membres.
--   owner  : tout, y compris rôles, suppression d'un commerce, facturation ;
--   admin  : gère les commerces (création, réglages) et invite des membres ;
--   member : travaille sur le contenu (campagnes, studio, catalogue, publicités).
-- Le quota de générations et l'offre sont ceux de l'organisation (offre de son propriétaire
-- jusqu'à l'arrivée des abonnements Stripe par organisation).
--
-- Aucune politique n'est supprimée : owns_business() est redéfinie (accès = membre de
-- l'organisation du commerce) et les politiques des commerces sont modifiées par ALTER POLICY.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index organizations_created_by_idx on public.organizations (created_by);
create trigger organizations_updated_at before update on public.organizations for each row execute function public.set_updated_at();

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_members_user_idx on public.organization_members (user_id);

create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  role text not null check (role in ('admin', 'member')),
  token_hash text not null unique check (char_length(token_hash) = 64),
  invited_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index organization_invitations_org_idx on public.organization_invitations (organization_id);
create index organization_invitations_invited_by_idx on public.organization_invitations (invited_by);
create index organization_invitations_accepted_by_idx on public.organization_invitations (accepted_by);
create unique index organization_invitations_pending_uidx on public.organization_invitations (organization_id, lower(email)) where accepted_at is null;

alter table public.plan_limits add column max_businesses integer not null default 1 check (max_businesses >= 1);
alter table public.plan_limits add column max_members integer not null default 1 check (max_members >= 1);
update public.plan_limits set max_businesses = 1, max_members = 1 where plan = 'free';
update public.plan_limits set max_businesses = 1, max_members = 2 where plan = 'starter';
update public.plan_limits set max_businesses = 3, max_members = 5 where plan = 'pro';
update public.plan_limits set max_businesses = 10, max_members = 15 where plan = 'business';

alter table public.businesses add column organization_id uuid references public.organizations (id) on delete cascade;
create index businesses_organization_idx on public.businesses (organization_id);

-- ---------------------------------------------------------------------------
-- Reprise de l'existant : une organisation par propriétaire actuel.
-- ---------------------------------------------------------------------------
do $$
declare r record; o uuid;
begin
  for r in
    select distinct on (owner_id) owner_id, name from public.businesses where organization_id is null order by owner_id, created_at
  loop
    insert into public.organizations (name, created_by) values (r.name, r.owner_id) returning id into o;
    insert into public.organization_members (organization_id, user_id, role) values (o, r.owner_id, 'owner');
    update public.businesses set organization_id = o where owner_id = r.owner_id and organization_id is null;
  end loop;
end $$;
alter table public.businesses alter column organization_id set not null;

-- ---------------------------------------------------------------------------
-- Fonctions d'accès (SECURITY DEFINER : évitent la récursion RLS, auth.uid() évalué une fois)
-- ---------------------------------------------------------------------------
create or replace function public.org_role(org uuid)
returns text language sql stable security definer set search_path = public as $$
  select role from public.organization_members where organization_id = org and user_id = (select auth.uid());
$$;

create or replace function public.is_org_member(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_members where organization_id = org and user_id = (select auth.uid()));
$$;

create or replace function public.can_manage_org(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_members where organization_id = org and user_id = (select auth.uid()) and role in ('owner', 'admin'));
$$;

-- Accès à un commerce = être membre de son organisation (toutes les politiques de contenu s'appuient dessus).
create or replace function public.owns_business(bid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.businesses b
    join public.organization_members m on m.organization_id = b.organization_id
    where b.id = bid and m.user_id = (select auth.uid())
  );
$$;

-- Offre de l'organisation : celle de son premier propriétaire (abonnement actif), sinon gratuite.
create or replace function public.org_plan(org uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((
    select case when s.status in ('active', 'trialing') then s.plan else 'free' end
    from public.organization_members m
    join public.subscriptions s on s.user_id = m.user_id
    where m.organization_id = org and m.role = 'owner'
    order by m.created_at
    limit 1
  ), 'free');
$$;

revoke execute on function public.org_role(uuid), public.is_org_member(uuid), public.can_manage_org(uuid), public.org_plan(uuid) from public, anon;
grant execute on function public.org_role(uuid), public.is_org_member(uuid), public.can_manage_org(uuid), public.org_plan(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Politiques
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invitations enable row level security;

create policy "organisation : lecture" on public.organizations for select using (public.is_org_member(id));
create policy "organisation : mise à jour" on public.organizations for update using (public.can_manage_org(id)) with check (public.can_manage_org(id));
create policy "membres : lecture" on public.organization_members for select using (public.is_org_member(organization_id));
create policy "invitations : lecture" on public.organization_invitations for select using (public.can_manage_org(organization_id));
-- Écritures sur les membres et invitations : uniquement via les fonctions ci-dessous.
revoke insert, update, delete on public.organization_members, public.organization_invitations from anon, authenticated;
revoke insert, delete on public.organizations from anon, authenticated;
-- Le hachage du jeton n'est jamais lisible côté client.
revoke select on public.organization_invitations from anon, authenticated;
grant select (id, organization_id, email, role, invited_by, expires_at, accepted_at, accepted_by, created_at)
  on public.organization_invitations to authenticated;

alter policy "commerce : lecture" on public.businesses using (public.is_org_member(organization_id));
alter policy "commerce : création" on public.businesses with check (owner_id = (select auth.uid()) and public.can_manage_org(organization_id));
alter policy "commerce : mise à jour" on public.businesses
  using (public.can_manage_org(organization_id)) with check (public.can_manage_org(organization_id));
alter policy "commerce : suppression" on public.businesses using (public.org_role(organization_id) = 'owner');

-- Nombre de commerces limité par l'offre ; un commerce ne change pas d'organisation.
create or replace function public.check_business_limits()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_max integer; v_count integer;
begin
  if tg_op = 'UPDATE' then
    if new.organization_id <> old.organization_id then raise exception 'Un commerce ne peut pas changer d''organisation'; end if;
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text, 1));
  select max_businesses into v_max from plan_limits where plan = public.org_plan(new.organization_id);
  select count(*) into v_count from businesses where organization_id = new.organization_id;
  if v_count >= coalesce(v_max, 1) then
    raise exception 'business_limit' using hint = 'Limite de commerces atteinte pour cette offre';
  end if;
  return new;
end $$;
create trigger businesses_limits before insert or update of organization_id on public.businesses
  for each row execute function public.check_business_limits();

-- ---------------------------------------------------------------------------
-- Opérations d'équipe (contrôles faits ici, jamais côté client)
-- ---------------------------------------------------------------------------
create or replace function public.create_organization(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_org uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if (select count(*) from organization_members where user_id = v_user and role = 'owner') >= 5 then
    raise exception 'org_limit' using hint = 'Nombre maximal d''organisations atteint';
  end if;
  insert into organizations (name, created_by) values (left(trim(p_name), 120), v_user) returning id into v_org;
  insert into organization_members (organization_id, user_id, role) values (v_org, v_user, 'owner');
  return v_org;
end $$;

create or replace function public.member_count(org uuid)
returns integer language sql stable security definer set search_path = public as $$
  select (select count(*) from organization_members where organization_id = org)::int
       + (select count(*) from organization_invitations where organization_id = org and accepted_at is null and expires_at > now())::int;
$$;

create or replace function public.invite_member(p_org uuid, p_email text, p_role text, p_token_hash text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_role text := public.org_role(p_org); v_max integer; v_id uuid; v_email text := lower(trim(p_email));
begin
  if v_role is null or v_role not in ('owner', 'admin') then raise exception 'forbidden'; end if;
  if p_role not in ('admin', 'member') then raise exception 'invalid_role'; end if;
  if exists (select 1 from organization_members m join auth.users u on u.id = m.user_id where m.organization_id = p_org and lower(u.email) = v_email) then
    raise exception 'already_member';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_org::text, 2));
  delete from organization_invitations where organization_id = p_org and lower(email) = v_email and accepted_at is null;
  select max_members into v_max from plan_limits where plan = public.org_plan(p_org);
  if public.member_count(p_org) >= coalesce(v_max, 1) then raise exception 'member_limit'; end if;
  insert into organization_invitations (organization_id, email, role, token_hash, invited_by, expires_at)
  values (p_org, v_email, p_role, p_token_hash, auth.uid(), now() + interval '7 days') returning id into v_id;
  return v_id;
end $$;

create or replace function public.revoke_invitation(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from organization_invitations i where i.id = p_id and i.accepted_at is null and public.can_manage_org(i.organization_id);
end $$;

create or replace function public.accept_invitation(p_token_hash text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_email text; inv organization_invitations%rowtype;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select lower(email) into v_email from auth.users where id = v_user;
  select * into inv from organization_invitations where token_hash = p_token_hash for update;
  if not found then raise exception 'invitation_invalid'; end if;
  if inv.accepted_at is not null then raise exception 'invitation_used'; end if;
  if inv.expires_at < now() then raise exception 'invitation_expired'; end if;
  if lower(inv.email) <> v_email then raise exception 'invitation_email'; end if;
  insert into organization_members (organization_id, user_id, role) values (inv.organization_id, v_user, inv.role)
  on conflict (organization_id, user_id) do nothing;
  update organization_invitations set accepted_at = now(), accepted_by = v_user where id = inv.id;
  return inv.organization_id;
end $$;

create or replace function public.update_member_role(p_org uuid, p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare v_target text;
begin
  if public.org_role(p_org) is distinct from 'owner' then raise exception 'forbidden'; end if;
  if p_role not in ('admin', 'member') then raise exception 'invalid_role'; end if;
  select role into v_target from organization_members where organization_id = p_org and user_id = p_user;
  if v_target is null then raise exception 'not_member'; end if;
  if v_target = 'owner' then raise exception 'owner_role_locked'; end if;
  update organization_members set role = p_role where organization_id = p_org and user_id = p_user;
end $$;

create or replace function public.remove_member(p_org uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); v_my text := public.org_role(p_org); v_target text;
begin
  select role into v_target from organization_members where organization_id = p_org and user_id = p_user;
  if v_target is null then raise exception 'not_member'; end if;
  if p_user = v_me then
    if v_target = 'owner' and (select count(*) from organization_members where organization_id = p_org and role = 'owner') = 1 then
      raise exception 'last_owner';
    end if;
  elsif v_my = 'owner' then
    if v_target = 'owner' then raise exception 'forbidden'; end if;
  elsif v_my = 'admin' then
    if v_target <> 'member' then raise exception 'forbidden'; end if;
  else
    raise exception 'forbidden';
  end if;
  delete from organization_members where organization_id = p_org and user_id = p_user;
end $$;

-- Aperçu d'une invitation pour la page d'acceptation (connaître le jeton suffit ; e-mail masqué).
create or replace function public.invitation_preview(p_token_hash text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'organization', o.name,
    'role', i.role,
    'email_hint', left(split_part(i.email, '@', 1), 2) || '***@' || split_part(i.email, '@', 2),
    'status', case when i.accepted_at is not null then 'used' when i.expires_at < now() then 'expired' else 'pending' end,
    'email_matches', lower(i.email) = (select lower(email) from auth.users where id = (select auth.uid()))
  )
  from organization_invitations i join organizations o on o.id = i.organization_id
  where i.token_hash = p_token_hash;
$$;

-- Membres avec nom et e-mail, visibles par les membres de la même organisation uniquement.
create or replace function public.org_members(p_org uuid)
returns table (user_id uuid, email text, full_name text, role text, joined_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.user_id, u.email::text, coalesce(p.full_name, ''), m.role, m.created_at
  from organization_members m
  join auth.users u on u.id = m.user_id
  left join profiles p on p.id = m.user_id
  where m.organization_id = p_org and public.is_org_member(p_org)
  order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m.created_at;
$$;

-- Quota de l'organisation (affichage) : même calcul que consume_generation.
create or replace function public.org_quota(p_business uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with b as (select organization_id from businesses where id = p_business and public.owns_business(p_business)),
  pl as (select public.org_plan((select organization_id from b)) plan)
  select case when not exists (select 1 from b) then null else jsonb_build_object(
    'plan', (select plan from pl),
    'quota', (select monthly_generations from plan_limits where plan = (select plan from pl)),
    'video_quota', (select monthly_video_credits from plan_limits where plan = (select plan from pl)),
    'used', (select coalesce(sum(l.credits_used), 0) from usage_logs l
             join businesses x on x.id = l.business_id
             where x.organization_id = (select organization_id from b)
               and l.action in ('generate_post','generate_youtube','generate_campaign','generate_ads','generate_product')
               and l.created_at >= date_trunc('month', now()))
  ) end;
$$;

revoke execute on function public.create_organization(text), public.member_count(uuid), public.invite_member(uuid, text, text, text),
  public.revoke_invitation(uuid), public.accept_invitation(text), public.update_member_role(uuid, uuid, text),
  public.remove_member(uuid, uuid), public.org_members(uuid), public.org_quota(uuid), public.invitation_preview(text) from public, anon;
grant execute on function public.create_organization(text), public.member_count(uuid), public.invite_member(uuid, text, text, text),
  public.revoke_invitation(uuid), public.accept_invitation(text), public.update_member_role(uuid, uuid, text),
  public.remove_member(uuid, uuid), public.org_members(uuid), public.org_quota(uuid), public.invitation_preview(text) to authenticated;
revoke execute on function public.check_business_limits() from public, anon, authenticated;
-- Interne à invite_member : pas d'appel direct.
revoke execute on function public.member_count(uuid) from authenticated;

-- ---------------------------------------------------------------------------
-- Quotas partagés par l'organisation
-- ---------------------------------------------------------------------------
create or replace function public.consume_generation(p_user uuid, p_business uuid, p_action text, p_key text, p_credits integer default 1)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_plan text;
  v_quota integer;
  v_used integer;
begin
  select b.organization_id into v_org from businesses b
  join organization_members m on m.organization_id = b.organization_id and m.user_id = p_user
  where b.id = p_business;
  if v_org is null then
    return jsonb_build_object('ok', false, 'reason', 'business');
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_org::text, 0));
  v_plan := public.org_plan(v_org);
  select monthly_generations into v_quota from plan_limits where plan = v_plan;
  select coalesce(sum(l.credits_used), 0) into v_used from usage_logs l
  join businesses x on x.id = l.business_id
  where x.organization_id = v_org
    and l.action in ('generate_post','generate_youtube','generate_campaign','generate_ads','generate_product')
    and l.created_at >= date_trunc('month', now());
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
