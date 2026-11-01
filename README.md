# Publia

Le studio marketing IA des commerces de proximité : publications, visuels, vidéos et YouTube.

**Stack** : Next.js 16 (App Router, TypeScript, Tailwind 4) · Supabase (Auth, PostgreSQL, Storage) · Vercel.

## État d'avancement

| Phase | Contenu | État |
| --- | --- | --- |
| 1 | Fondations : landing, auth, navigation, tableau de bord, schéma Supabase | Fait |
| 2 | Profil du commerce, logo, couleurs | À faire |
| 3 | Génération de publications (OpenAI) | À faire |
| 4 | Éditeur graphique, 12 modèles, export PNG | À faire |
| 5 | Vidéos IA (fournisseur à valider), export MP4 | À faire |
| 6 | YouTube Studio : Shorts, 16:9, miniatures 1280×720 | À faire |
| 7 | Stripe : abonnements, packs vidéo, quotas | À faire |
| 8 | Sécurité, tests, RGPD, déploiement | À faire |
| 9 | Publication connectée (YouTube Data API v3, etc.) | Plus tard |

Les limites YouTube sont centralisées dans `src/lib/config/youtube.ts`, les formats dans `src/lib/config/platforms.ts`.

## Mise en route

1. **Supabase** : créer un projet (région UE), puis exécuter `supabase/migrations/20261101000001_init.sql`
   dans *SQL Editor* (ou `supabase db push`).
2. *Authentication → URL Configuration* : Site URL = l'URL Vercel, Redirect URLs = `https://<domaine>/auth/confirmation`.
3. *Authentication → Email Templates* : dans « Confirm signup » et « Reset password », utiliser
   `{{ .SiteURL }}/auth/confirmation?token_hash={{ .TokenHash }}&type=email&suite=/tableau-de-bord`
   (pour la réinitialisation : `type=recovery&suite=/reinitialisation`).
4. **Vercel** : importer le dépôt GitHub, ajouter les variables de `.env.example` (au minimum les deux `NEXT_PUBLIC_SUPABASE_*`).
5. En local : `cp .env.example .env.local`, `npm install`, `npm run dev`.

## Règles du projet

- Toute logique métier et toute clé secrète restent côté serveur.
- RLS activé sur toutes les tables ; crédits, abonnements, jobs et jetons ne sont écrits que par le serveur.
- Aucun résultat simulé : pas de fausse vidéo, de faux paiement ni de fausse publication.
- Un administrateur s'ajoute uniquement en SQL : `insert into app_admins (user_id) values ('<uuid>');`
