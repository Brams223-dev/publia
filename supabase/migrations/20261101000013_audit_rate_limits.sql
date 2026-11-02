-- Phase 0.6 — Journal d'audit des actions sensibles et limites de débit.
--
-- Le journal est alimenté par des déclencheurs en base : il enregistre l'action quel que soit
-- le chemin (application, API, SQL) et ne peut pas être modifié par les utilisateurs.
-- Lecture réservée au propriétaire et aux administrateurs de l'organisation.

create table public.audit_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete set null,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (char_length(action) <= 60),
  target_type text not null check (char_length(target_type) <= 40),
  target_id text,
  details jsonb not null default '{}'::jsonb
);
create index audit_log_org_created_idx on public.audit_log (organization_id, created_at desc);
create index audit_log_business_idx on public.audit_log (business_id);
create index audit_log_actor_idx on public.audit_log (actor_id);
alter table public.audit_log enable row level security;
create policy "journal : lecture" on public.audit_log for select using (public.can_manage_org(organization_id));
revoke insert, update, delete on public.audit_log from anon, authenticated;

create or replace function public.audit_write(p_org uuid, p_business uuid, p_action text, p_type text, p_target text, p_details jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  -- Organisation en cours de suppression : rien à journaliser (cascade).
  if p_org is null or not exists (select 1 from organizations where id = p_org) then return; end if;
  if p_business is not null and not exists (select 1 from businesses where id = p_business) then p_business := null; end if;
  insert into audit_log (organization_id, business_id, actor_id, action, target_type, target_id, details)
  values (p_org, p_business, auth.uid(), p_action, p_type, p_target, coalesce(p_details, '{}'::jsonb));
end $$;
revoke execute on function public.audit_write(uuid, uuid, text, text, text, jsonb) from public, anon, authenticated;

create or replace function public.org_of_business(bid uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select organization_id from businesses where id = bid;
$$;
revoke execute on function public.org_of_business(uuid) from public, anon, authenticated;

create or replace function public.audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_email text; v_fields jsonb;
begin
  if tg_table_name = 'organization_members' then
    select email into v_email from auth.users where id = coalesce(new.user_id, old.user_id);
    if tg_op = 'INSERT' then
      perform audit_write(new.organization_id, null, 'member.added', 'member', new.user_id::text, jsonb_build_object('email', v_email, 'role', new.role));
    elsif tg_op = 'UPDATE' and new.role is distinct from old.role then
      perform audit_write(new.organization_id, null, 'member.role_changed', 'member', new.user_id::text, jsonb_build_object('email', v_email, 'from', old.role, 'to', new.role));
    elsif tg_op = 'DELETE' then
      perform audit_write(old.organization_id, null, case when old.user_id = auth.uid() then 'member.left' else 'member.removed' end, 'member', old.user_id::text, jsonb_build_object('email', v_email, 'role', old.role));
    end if;

  elsif tg_table_name = 'organization_invitations' then
    if tg_op = 'INSERT' then
      perform audit_write(new.organization_id, null, 'invitation.created', 'invitation', new.id::text, jsonb_build_object('email', new.email, 'role', new.role));
    elsif tg_op = 'UPDATE' and new.accepted_at is not null and old.accepted_at is null then
      perform audit_write(new.organization_id, null, 'invitation.accepted', 'invitation', new.id::text, jsonb_build_object('email', new.email, 'role', new.role));
    elsif tg_op = 'DELETE' and old.accepted_at is null then
      perform audit_write(old.organization_id, null, 'invitation.revoked', 'invitation', old.id::text, jsonb_build_object('email', old.email));
    end if;

  elsif tg_table_name = 'organizations' then
    if tg_op = 'UPDATE' and new.name is distinct from old.name then
      perform audit_write(new.id, null, 'organization.renamed', 'organization', new.id::text, jsonb_build_object('from', old.name, 'to', new.name));
    end if;

  elsif tg_table_name = 'businesses' then
    if tg_op = 'INSERT' then
      perform audit_write(new.organization_id, new.id, 'business.created', 'business', new.id::text, jsonb_build_object('name', new.name));
    elsif tg_op = 'UPDATE' then
      -- Seuls les noms des champs modifiés sont enregistrés, jamais leur contenu.
      select coalesce(jsonb_agg(n.key order by n.key), '[]'::jsonb) into v_fields
      from jsonb_each(to_jsonb(new)) n join jsonb_each(to_jsonb(old)) o on o.key = n.key
      where n.value is distinct from o.value and n.key <> 'updated_at';
      if jsonb_array_length(v_fields) > 0 then
        perform audit_write(new.organization_id, new.id, 'business.updated', 'business', new.id::text, jsonb_build_object('fields', v_fields));
      end if;
    elsif tg_op = 'DELETE' then
      perform audit_write(old.organization_id, null, 'business.deleted', 'business', old.id::text, jsonb_build_object('name', old.name));
    end if;

  elsif tg_table_name = 'products' then
    if tg_op = 'DELETE' then
      perform audit_write(org_of_business(old.business_id), old.business_id, 'product.deleted', 'product', old.id::text, jsonb_build_object('name', old.name));
    elsif tg_op = 'UPDATE' then
      if new.status is distinct from old.status and new.status in ('active', 'archived') then
        perform audit_write(org_of_business(new.business_id), new.business_id, 'product.' || case new.status when 'active' then 'activated' else 'archived' end, 'product', new.id::text, jsonb_build_object('name', new.name));
      end if;
      if coalesce((new.compliance ->> 'confirmed')::boolean, false) and not coalesce((old.compliance ->> 'confirmed')::boolean, false) then
        perform audit_write(org_of_business(new.business_id), new.business_id, 'product.compliance_confirmed', 'product', new.id::text,
          jsonb_build_object('name', new.name, 'level', new.compliance ->> 'level'));
      end if;
    end if;

  elsif tg_table_name = 'ad_campaigns' then
    if tg_op = 'DELETE' then
      perform audit_write(org_of_business(old.business_id), old.business_id, 'ad_campaign.deleted', 'ad_campaign', old.id::text, jsonb_build_object('name', old.name));
    elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
      perform audit_write(org_of_business(new.business_id), new.business_id, 'ad_campaign.status', 'ad_campaign', new.id::text, jsonb_build_object('name', new.name, 'from', old.status, 'to', new.status));
    end if;

  elsif tg_table_name = 'campaigns' then
    if tg_op = 'DELETE' then
      perform audit_write(org_of_business(old.business_id), old.business_id, 'campaign.deleted', 'campaign', old.id::text, jsonb_build_object('title', old.title));
    end if;
  end if;
  return coalesce(new, old);
end $$;
revoke execute on function public.audit_trigger() from public, anon, authenticated;

create trigger audit_organization_members after insert or update or delete on public.organization_members for each row execute function public.audit_trigger();
create trigger audit_organization_invitations after insert or update or delete on public.organization_invitations for each row execute function public.audit_trigger();
create trigger audit_organizations after update on public.organizations for each row execute function public.audit_trigger();
create trigger audit_businesses after insert or update or delete on public.businesses for each row execute function public.audit_trigger();
create trigger audit_products after update or delete on public.products for each row execute function public.audit_trigger();
create trigger audit_ad_campaigns after update or delete on public.ad_campaigns for each row execute function public.audit_trigger();
create trigger audit_campaigns after delete on public.campaigns for each row execute function public.audit_trigger();

-- ---------------------------------------------------------------------------
-- Limites de débit (fenêtre fixe, par utilisateur et par catégorie d'action)
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null check (char_length(bucket) <= 40),
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (user_id, bucket, window_start)
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- Renvoie vrai si l'action est autorisée. L'utilisateur est toujours celui de la session :
-- impossible de consommer la limite de quelqu'un d'autre.
create or replace function public.rate_limit_hit(p_bucket text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_start timestamptz; v_hits integer;
begin
  if v_user is null or p_limit < 1 or p_window_seconds < 1 or p_window_seconds > 86400 then return false; end if;
  v_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into rate_limits (user_id, bucket, window_start, hits) values (v_user, left(p_bucket, 40), v_start, 1)
  on conflict (user_id, bucket, window_start) do update set hits = rate_limits.hits + 1
  returning hits into v_hits;
  -- Nettoyage occasionnel des fenêtres expirées.
  if random() < 0.01 then delete from rate_limits where window_start < now() - interval '2 days'; end if;
  return v_hits <= p_limit;
end $$;
revoke execute on function public.rate_limit_hit(text, integer, integer) from public, anon;
grant execute on function public.rate_limit_hit(text, integer, integer) to authenticated;
