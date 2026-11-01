-- Corrections des avis de sécurité Supabase
alter function public.set_updated_at() set search_path = public;

-- Fonction de déclencheur : jamais appelable via l'API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Utilisée par les politiques RLS : nécessaire aux utilisateurs connectés uniquement.
revoke execute on function public.owns_business(uuid) from public, anon;
grant execute on function public.owns_business(uuid) to authenticated;
