-- Optimisation des politiques RLS : (select auth.uid()) évalué une seule fois par requête.
-- Sans impact fonctionnel. À appliquer quand la confirmation des suppressions de politiques est possible.

drop policy "profil : lecture" on public.profiles;
drop policy "profil : mise à jour" on public.profiles;
create policy "profil : lecture" on public.profiles for select using (id = (select auth.uid()));
create policy "profil : mise à jour" on public.profiles for update using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy "commerce : lecture" on public.businesses;
drop policy "commerce : création" on public.businesses;
drop policy "commerce : mise à jour" on public.businesses;
drop policy "commerce : suppression" on public.businesses;
create policy "commerce : lecture" on public.businesses for select using (owner_id = (select auth.uid()));
create policy "commerce : création" on public.businesses for insert with check (owner_id = (select auth.uid()));
create policy "commerce : mise à jour" on public.businesses for update using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "commerce : suppression" on public.businesses for delete using (owner_id = (select auth.uid()));

drop policy "modèles : lecture des actifs" on public.templates;
create policy "modèles : lecture des actifs" on public.templates for select to authenticated using (is_active);

drop policy "abonnement : lecture" on public.subscriptions;
drop policy "conso : lecture" on public.usage_logs;
drop policy "conso vidéo : lecture" on public.video_usage;
drop policy "jobs : lecture" on public.generation_jobs;
drop policy "uploads youtube : lecture" on public.youtube_uploads;
drop policy "comptes sociaux : lecture" on public.social_accounts;
create policy "abonnement : lecture" on public.subscriptions for select using (user_id = (select auth.uid()));
create policy "conso : lecture" on public.usage_logs for select using (user_id = (select auth.uid()));
create policy "conso vidéo : lecture" on public.video_usage for select using (user_id = (select auth.uid()));
create policy "jobs : lecture" on public.generation_jobs for select using (user_id = (select auth.uid()));
create policy "uploads youtube : lecture" on public.youtube_uploads for select using (user_id = (select auth.uid()));
create policy "comptes sociaux : lecture" on public.social_accounts for select using (user_id = (select auth.uid()));

