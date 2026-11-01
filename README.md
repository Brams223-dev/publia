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
| Publia Commerce — catalogue universel | 26 catégories extensibles (en base), attributs dynamiques typés et validés, variantes et stocks (unité, poids, longueur, précommande, sur commande), types de vente, collections, recherche/filtres/tri, modèles de boutique par métier, assistant IA de fiche produit (déclaré / observé / suggéré), contrôles de conformité par pays (FR) | Fait |
| Publia Commerce — vente en ligne | Vitrine publique, panier, paiement Stripe, commandes, livraison, téléchargements numériques, réservations | À venir |
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

## Internationalisation (préparée, France seule active)

| Sujet | Où | Lancement |
| --- | --- | --- |
| Pays, langue, devise, fuseau, taxe, paiement, support | `src/config/markets.ts` (source unique) | France · fr · EUR · Europe/Paris |
| Textes d'interface | `src/i18n/messages/<langue>.ts` + `t()` / `messages` | fr uniquement |
| Formatage montants, nombres, dates | `src/lib/format.ts` (jamais de locale/devise en dur) | fr-FR / EUR |
| Prix par marché et devise | table `plan_prices` (+ repli `src/config/pricing.ts`) | FR en EUR TTC |
| Taxes par marché | table `tax_rates` | TVA 20 % |
| Marché d'un commerce (locataire) | colonnes `businesses.country_code, locale, currency, timezone` | FR par défaut |
| Fournisseur IA | `src/lib/ai` (`AI_PROVIDER`, OpenAI par défaut) | OpenAI |
| Paiement | `src/lib/payments` (interface, une implémentation par fournisseur) | aucune active |
| Multi-tenant | RLS Supabase par commerce (`owns_business`) sur toutes les tables exposées | actif |

Activer un nouveau pays : suivre la liste de vérifications en tête de `src/config/markets.ts`
(technique, commerciale, fiscale, réglementaire, traductions, prix et taxes en base) avant `active: true`.
Les textes déjà migrés dans `src/i18n` : métadonnées, menu, statuts, offres ; les autres écrans suivent au fil des évolutions.

## Qualité et suivi des erreurs

- `npm test` : tests unitaires et tests des migrations SQL (Postgres embarqué, aucune connexion à la production).
- `npm run check` : lint + types + tests. GitHub Actions lance aussi la compilation à chaque envoi sur `main`.
- Les erreurs serveur, d'actions et du navigateur (utilisateurs connectés, 20 par heure maximum) sont enregistrées dans la table `app_errors` (Supabase), secrets masqués. Consultation : Supabase → Table Editor → `app_errors`.
