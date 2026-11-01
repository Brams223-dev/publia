-- Publia Commerce — moteur de catalogue universel (un seul moteur pour tous les métiers).
-- Les caractéristiques propres à chaque type de produit sont décrites par un schéma d'attributs
-- typé, stocké par catégorie : aucune colonne spécifique à un métier.

-- ---------------------------------------------------------------------------
-- Catégories (taxonomie extensible, enrichissable sans modifier le code)
-- attribute_schema : [{ key, label, type, unit?, options?, required?, filterable? }]
-- type ∈ text | textarea | number | select | multiselect | boolean | date
-- ---------------------------------------------------------------------------
create table public.product_categories (
  id text primary key check (id ~ '^[a-z0-9-]{2,60}$'),
  parent_id text references public.product_categories (id) on delete set null,
  name text not null,
  translations jsonb not null default '{}'::jsonb,
  attribute_schema jsonb not null default '[]'::jsonb check (jsonb_typeof(attribute_schema) = 'array'),
  sale_types text[] not null default '{physical}',
  regulated boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0
);
alter table public.product_categories enable row level security;
create policy "catégories : lecture" on public.product_categories for select to authenticated using (active);

insert into public.product_categories (id, name, sale_types, regulated, sort_order, attribute_schema) values
('mode', 'Mode et vêtements', '{physical,custom}', false, 1, '[{"key":"taille","label":"Taille","type":"text","filterable":true},{"key":"couleur","label":"Couleur","type":"text","filterable":true},{"key":"matiere","label":"Matière","type":"text"},{"key":"coupe","label":"Coupe","type":"text"},{"key":"genre","label":"Pour","type":"select","options":["Femme","Homme","Enfant","Mixte"],"filterable":true}]'),
('chaussures', 'Chaussures', '{physical}', false, 2, '[{"key":"pointure","label":"Pointure","type":"text","filterable":true},{"key":"couleur","label":"Couleur","type":"text","filterable":true},{"key":"matiere","label":"Matière","type":"text"},{"key":"genre","label":"Pour","type":"select","options":["Femme","Homme","Enfant","Mixte"],"filterable":true}]'),
('maroquinerie', 'Sacs et maroquinerie', '{physical}', false, 3, '[{"key":"matiere","label":"Matière","type":"text","filterable":true},{"key":"couleur","label":"Couleur","type":"text","filterable":true},{"key":"dimensions","label":"Dimensions","type":"text"}]'),
('bijoux', 'Bijoux et accessoires', '{physical,custom}', false, 4, '[{"key":"matiere","label":"Matière","type":"text","filterable":true},{"key":"couleur","label":"Couleur","type":"text"},{"key":"taille","label":"Taille","type":"text"}]'),
('electronique', 'Téléphones et électronique', '{physical}', false, 5, '[{"key":"modele","label":"Modèle","type":"text","filterable":true},{"key":"capacite","label":"Capacité de stockage","type":"text","filterable":true},{"key":"memoire","label":"Mémoire","type":"text"},{"key":"connectivite","label":"Connectivité","type":"multiselect","options":["Wi-Fi","Bluetooth","4G","5G","USB-C","NFC"]},{"key":"etat","label":"État","type":"select","options":["Neuf","Reconditionné","Occasion"],"required":true,"filterable":true},{"key":"garantie_mois","label":"Garantie","type":"number","unit":"mois"}]'),
('informatique', 'Informatique', '{physical}', false, 6, '[{"key":"modele","label":"Modèle","type":"text","filterable":true},{"key":"processeur","label":"Processeur","type":"text"},{"key":"memoire","label":"Mémoire vive","type":"text"},{"key":"stockage","label":"Stockage","type":"text","filterable":true},{"key":"etat","label":"État","type":"select","options":["Neuf","Reconditionné","Occasion"],"required":true,"filterable":true},{"key":"garantie_mois","label":"Garantie","type":"number","unit":"mois"}]'),
('electromenager', 'Électroménager', '{physical}', false, 7, '[{"key":"modele","label":"Modèle","type":"text"},{"key":"classe_energie","label":"Classe énergétique","type":"select","options":["A","B","C","D","E","F","G"],"filterable":true},{"key":"puissance_w","label":"Puissance","type":"number","unit":"W"},{"key":"etat","label":"État","type":"select","options":["Neuf","Reconditionné","Occasion"],"required":true},{"key":"garantie_mois","label":"Garantie","type":"number","unit":"mois"}]'),
('maison', 'Maison et décoration', '{physical,custom}', false, 8, '[{"key":"matiere","label":"Matière","type":"text","filterable":true},{"key":"couleur","label":"Couleur","type":"text","filterable":true},{"key":"style","label":"Style","type":"text"}]'),
('meubles', 'Meubles', '{physical,made_to_order}', false, 9, '[{"key":"longueur_cm","label":"Longueur","type":"number","unit":"cm"},{"key":"largeur_cm","label":"Largeur","type":"number","unit":"cm"},{"key":"hauteur_cm","label":"Hauteur","type":"number","unit":"cm"},{"key":"materiaux","label":"Matériaux","type":"text","filterable":true},{"key":"couleurs","label":"Couleurs","type":"text","filterable":true},{"key":"montage","label":"Montage requis","type":"boolean"}]'),
('beaute', 'Beauté et cosmétiques', '{physical}', true, 10, '[{"key":"contenance","label":"Contenance","type":"text"},{"key":"type_peau","label":"Type de peau","type":"text","filterable":true},{"key":"ingredients","label":"Composition (INCI)","type":"textarea"},{"key":"pao_mois","label":"Durée après ouverture","type":"number","unit":"mois"}]'),
('soin', 'Produits de soin', '{physical}', true, 11, '[{"key":"contenance","label":"Contenance","type":"text"},{"key":"ingredients","label":"Composition","type":"textarea"},{"key":"precautions","label":"Précautions d''emploi","type":"textarea"}]'),
('alimentation', 'Alimentation et épicerie', '{physical}', true, 12, '[{"key":"ingredients","label":"Ingrédients","type":"textarea","required":true},{"key":"allergenes","label":"Allergènes","type":"multiselect","options":["Gluten","Crustacés","Œufs","Poissons","Arachides","Soja","Lait","Fruits à coque","Céleri","Moutarde","Sésame","Sulfites","Lupin","Mollusques"],"filterable":true},{"key":"poids_net","label":"Poids net","type":"text"},{"key":"conservation","label":"Conservation","type":"text"},{"key":"dlc","label":"Date limite applicable","type":"select","options":["DLC","DDM","Sans objet"]},{"key":"origine","label":"Origine","type":"text","filterable":true}]'),
('boissons', 'Boissons', '{physical}', true, 13, '[{"key":"contenance","label":"Contenance","type":"text"},{"key":"ingredients","label":"Ingrédients","type":"textarea"},{"key":"alcool","label":"Contient de l''alcool","type":"boolean","required":true},{"key":"degre","label":"Degré d''alcool","type":"number","unit":"% vol."},{"key":"origine","label":"Origine","type":"text","filterable":true}]'),
('fleurs', 'Fleurs et plantes', '{physical,custom}', false, 14, '[{"key":"varietes","label":"Variétés","type":"text"},{"key":"taille","label":"Taille","type":"select","options":["Petit","Moyen","Grand"],"filterable":true},{"key":"entretien","label":"Entretien","type":"textarea"}]'),
('jardinage', 'Jardinage', '{physical}', false, 15, '[{"key":"usage","label":"Usage","type":"text"},{"key":"matiere","label":"Matière","type":"text"},{"key":"dimensions","label":"Dimensions","type":"text"}]'),
('bricolage', 'Bricolage et outillage', '{physical}', false, 16, '[{"key":"marque_compatible","label":"Compatibilité","type":"text"},{"key":"alimentation","label":"Alimentation","type":"select","options":["Secteur","Batterie","Manuel","Thermique"],"filterable":true},{"key":"puissance_w","label":"Puissance","type":"number","unit":"W"},{"key":"garantie_mois","label":"Garantie","type":"number","unit":"mois"}]'),
('auto', 'Automobile et pièces détachées', '{physical}', false, 17, '[{"key":"ref_fabricant","label":"Référence fabricant","type":"text","required":true,"filterable":true},{"key":"marque_vehicule","label":"Marque du véhicule","type":"text","filterable":true},{"key":"modele_compatible","label":"Modèle compatible","type":"text","filterable":true},{"key":"annee","label":"Année du véhicule","type":"text"},{"key":"motorisation","label":"Motorisation","type":"text"},{"key":"etat","label":"État","type":"select","options":["Neuf","Occasion","Reconditionné"],"required":true}]'),
('sport', 'Sport et loisirs', '{physical}', false, 18, '[{"key":"sport","label":"Sport","type":"text","filterable":true},{"key":"taille","label":"Taille","type":"text"},{"key":"niveau","label":"Niveau","type":"select","options":["Débutant","Intermédiaire","Confirmé"]}]'),
('jouets', 'Jouets et jeux', '{physical}', true, 19, '[{"key":"age_min","label":"Âge minimum","type":"number","unit":"ans","required":true,"filterable":true},{"key":"joueurs","label":"Nombre de joueurs","type":"text"},{"key":"avertissements","label":"Avertissements de sécurité","type":"textarea"}]'),
('livres', 'Livres et papeterie', '{physical,digital}', false, 20, '[{"key":"auteur","label":"Auteur","type":"text","filterable":true},{"key":"editeur","label":"Éditeur","type":"text"},{"key":"isbn","label":"ISBN","type":"text"},{"key":"langue","label":"Langue","type":"text","filterable":true},{"key":"etat","label":"État","type":"select","options":["Neuf","Occasion"]}]'),
('artisanat', 'Artisanat', '{physical,custom,made_to_order}', false, 21, '[{"key":"technique","label":"Technique","type":"text"},{"key":"matiere","label":"Matière","type":"text","filterable":true},{"key":"dimensions","label":"Dimensions","type":"text"},{"key":"piece_unique","label":"Pièce unique","type":"boolean"}]'),
('fait-main', 'Produits faits main', '{physical,custom,made_to_order}', false, 22, '[{"key":"matiere","label":"Matière","type":"text","filterable":true},{"key":"delai_fabrication_jours","label":"Délai de fabrication","type":"number","unit":"jours"},{"key":"personnalisable","label":"Personnalisable","type":"boolean"}]'),
('numerique', 'Produits numériques', '{digital}', false, 23, '[{"key":"format","label":"Format","type":"text","required":true,"filterable":true},{"key":"taille_fichier","label":"Taille du fichier","type":"text"},{"key":"licence","label":"Licence","type":"text","required":true},{"key":"version","label":"Version","type":"text"},{"key":"telechargement","label":"Conditions de téléchargement","type":"textarea"}]'),
('formations', 'Formations et contenus téléchargeables', '{digital,service}', false, 24, '[{"key":"format","label":"Format","type":"select","options":["Vidéo","PDF","Audio","En direct","Présentiel"],"filterable":true},{"key":"duree","label":"Durée","type":"text"},{"key":"niveau","label":"Niveau","type":"select","options":["Débutant","Intermédiaire","Avancé"]},{"key":"acces","label":"Durée d''accès","type":"text"}]'),
('services', 'Services et prestations', '{service,booking}', false, 25, '[{"key":"duree_minutes","label":"Durée","type":"number","unit":"min"},{"key":"lieu","label":"Lieu","type":"select","options":["En boutique","À domicile","À distance"],"filterable":true},{"key":"sur_rendez_vous","label":"Sur rendez-vous","type":"boolean"}]'),
('autre', 'Autres', '{physical,digital,service}', false, 99, '[]');

-- ---------------------------------------------------------------------------
-- Boutique (réglages par commerce)
-- ---------------------------------------------------------------------------
create table public.shops (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  template text not null default 'generaliste',
  name text,
  slug text unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  published boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger shops_updated_at before update on public.shops for each row execute function public.set_updated_at();
alter table public.shops enable row level security;
create policy "boutique : tout" on public.shops for all using (public.owns_business(business_id)) with check (public.owns_business(business_id));

-- ---------------------------------------------------------------------------
-- Produits
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  category_id text not null references public.product_categories (id),
  sale_type text not null default 'physical' check (sale_type in ('physical','digital','custom','made_to_order','bundle','service','booking')),
  name text not null check (char_length(name) between 1 and 200),
  description text check (char_length(description) <= 5000),
  brand text check (char_length(brand) <= 120),
  sku text check (char_length(sku) <= 80),
  price_cents integer not null check (price_cents >= 0),
  compare_at_cents integer check (compare_at_cents is null or compare_at_cents > 0),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  unit text not null default 'unit' check (unit in ('unit','kg','g','l','ml','m','cm','m2','hour','session')),
  stock_policy text not null default 'tracked' check (stock_policy in ('tracked','untracked','preorder','on_order')),
  stock_quantity integer check (stock_quantity is null or stock_quantity >= 0),
  weight_g integer check (weight_g is null or weight_g >= 0),
  dimensions jsonb not null default '{}'::jsonb,
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  has_variants boolean not null default false,
  status text not null default 'draft' check (status in ('draft','active','archived','review')),
  compliance_status text not null default 'ok' check (compliance_status in ('ok','to_verify','blocked')),
  seo jsonb not null default '{}'::jsonb,
  ai_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (compare_at_cents is null or compare_at_cents > price_cents)
);
create index products_business_idx on public.products (business_id, created_at desc);
create index products_category_idx on public.products (business_id, category_id);
create index products_status_idx on public.products (business_id, status);
create unique index products_sku_uidx on public.products (business_id, sku) where sku is not null;
create index products_attributes_gin on public.products using gin (attributes);
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();
alter table public.products enable row level security;
create policy "produits : tout" on public.products for all using (public.owns_business(business_id)) with check (public.owns_business(business_id));

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  options jsonb not null check (jsonb_typeof(options) = 'object'),   -- { "Taille": "M", "Couleur": "Noir" }
  sku text check (char_length(sku) <= 80),
  price_cents integer check (price_cents is null or price_cents >= 0),
  stock_quantity integer check (stock_quantity is null or stock_quantity >= 0),
  active boolean not null default true,
  sort_order integer not null default 0
);
create index product_variants_product_idx on public.product_variants (product_id, sort_order);
create index product_variants_business_idx on public.product_variants (business_id);
create unique index product_variants_sku_uidx on public.product_variants (business_id, sku) where sku is not null;
alter table public.product_variants enable row level security;
create policy "variantes produit : tout" on public.product_variants for all using (public.owns_business(business_id)) with check (public.owns_business(business_id));

create table public.product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  file_path text not null,
  kind text not null default 'image' check (kind in ('image','video')),
  origin text not null default 'original' check (origin in ('original','enhanced','generated')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index product_media_product_idx on public.product_media (product_id, sort_order);
create index product_media_business_idx on public.product_media (business_id);
alter table public.product_media enable row level security;
create policy "médias produit : tout" on public.product_media for all using (public.owns_business(business_id)) with check (public.owns_business(business_id));

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text check (char_length(description) <= 1000),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index collections_business_idx on public.collections (business_id, sort_order);
alter table public.collections enable row level security;
create policy "collections : tout" on public.collections for all using (public.owns_business(business_id)) with check (public.owns_business(business_id));

create table public.collection_products (
  collection_id uuid not null references public.collections (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (collection_id, product_id)
);
create index collection_products_product_idx on public.collection_products (product_id);
create index collection_products_business_idx on public.collection_products (business_id);
alter table public.collection_products enable row level security;
create policy "collection produits : tout" on public.collection_products for all using (public.owns_business(business_id)) with check (public.owns_business(business_id));

-- Crédit IA pour les fiches produit.
alter table public.usage_logs drop constraint usage_logs_action_check;
alter table public.usage_logs add constraint usage_logs_action_check check (action in (
  'generate_post','generate_youtube','generate_campaign','generate_ads','generate_product','generate_video','render_thumbnail',
  'image_generation','background_removal','virtual_tryon','video_generation','avatar_creation'));

create or replace function public.consume_generation(p_user uuid, p_business uuid, p_action text, p_key text, p_credits integer default 1)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_plan text;
  v_quota integer;
  v_used integer;
begin
  if not exists (select 1 from businesses where id = p_business and owner_id = p_user) then
    return jsonb_build_object('ok', false, 'reason', 'business');
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  select case when s.status in ('active','trialing') then s.plan else 'free' end into v_plan
  from subscriptions s where s.user_id = p_user;
  v_plan := coalesce(v_plan, 'free');
  select monthly_generations into v_quota from plan_limits where plan = v_plan;
  select coalesce(sum(credits_used), 0) into v_used from usage_logs
  where user_id = p_user
    and action in ('generate_post','generate_youtube','generate_campaign','generate_ads','generate_product')
    and created_at >= date_trunc('month', now());
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

insert into public.credit_costs (operation, label, credits, provider, active)
values ('generate_product', 'Fiche produit IA', 1, 'openai', true)
on conflict (operation) do nothing;
