# Publia

Le studio marketing IA des commerces de proximité : publications, visuels, vidéos et YouTube.

**Stack** : Next.js 16 (App Router, TypeScript, Tailwind 4) · Supabase (Auth, PostgreSQL, Storage) · Vercel.

## État d'avancement (Master Plan)

| Étape | Contenu | État |
| --- | --- | --- |
| Fondations | Auth, profil intelligent du commerce, identité de marque, tableau de bord 4 piliers | Fait |
| Fais ma communication | Campagne multi-réseaux générée par OpenAI, modifiable et validable | Fait (clés à configurer) |
| Studio visuel + Bibliothèque | 12 modèles, 5 formats (dont miniature YouTube 1280×720), logo, couleurs, export PNG/JPG | Fait |
| Assistant marketing | Assistant conversationnel, calendrier, packs métier | À faire |
| Vidéo + YouTube Studio | Fournisseur vidéo réel, Shorts, miniatures | À faire |
| Business | Avis Google, visibilité locale, contacts, fidélité, mini-site | À faire |
| Autopilot — étape 1 | Règles hebdo, créneaux de départ, calendrier jour/semaine/mois, programmées, historique, mode manuel | Fait |
| Autopilot — étape 2 | Publication automatique via API officielles (Meta, TikTok, YouTube) | Après validation des plateformes |
| Fashion AI | Photo produit, mannequin virtuel, Mon Avatar, Fashion Motion, Vinted Studio | À faire (fournisseurs à valider) |
| Publia Ads — V1 | Assistant de campagne, Ads Factory (variantes IA), ciblage conforme, budget plafonné, prévisualisations, simulation identifiée | Fait |
| Publia Ads — V2/V3 | Connexion Meta / TikTok / Google Ads, statistiques réelles, lancement après validation, tests A/B | Après accès officiels |
| Intelligence | Analytics, recommandations | Plus tard |
| Stripe | Free / Starter / Pro / Business, quotas | À faire |

Quotas : la table `plan_limits` est la source de vérité ; `consume_generation()` (service_role uniquement) réserve un crédit
de façon atomique avant chaque génération, et `refund_generation()` le rend en cas d'échec.

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
