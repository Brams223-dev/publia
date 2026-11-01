import type { Metadata } from "next";
import Link from "next/link";
import { ImageOff, Package, Plus, Search, Sparkles, SlidersHorizontal } from "lucide-react";
import { getCurrentBusiness } from "@/lib/business";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCategories, signPaths } from "@/lib/commerce/catalog";
import { LIMITS, PRODUCT_STATUS, SORTS, STOCK_POLICIES, templateById, type ProductStatus, type SortId } from "@/lib/commerce/config";
import { parseMoneyToCents } from "@/lib/commerce/money";
import { formatMoney } from "@/lib/format";
import { getMarket } from "@/config/markets";
import { CollectionsPanel } from "./collections-panel";

export const metadata: Metadata = { title: "Catalogue" };

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

export default async function CataloguePage({ searchParams }: { searchParams: Promise<SP> }) {
  if (!isSupabaseConfigured()) return null;
  const sp = await searchParams;
  const { supabase, business } = await getCurrentBusiness();
  if (!business)
    return (
      <div className="mt-4 card p-6">
        <p className="font-semibold">Présentez d&apos;abord votre commerce</p>
        <Link href="/mon-commerce" className="btn-primary mt-4">Renseigner mon commerce</Link>
      </div>
    );

  const market = getMarket(business.country_code);
  const [categories, { data: shop }, { data: collections }] = await Promise.all([
    getCategories(supabase),
    supabase.from("shops").select("template").eq("business_id", business.id).maybeSingle(),
    supabase.from("collections").select("id, name").eq("business_id", business.id).order("sort_order"),
  ]);
  const template = templateById(shop?.template);

  // Catégories mises en avant selon le modèle de boutique, puis les autres.
  const featured = template.categories.length
    ? [...template.categories.map((id) => categories.find((c) => c.id === id)!).filter(Boolean), ...categories.filter((c) => !template.categories.includes(c.id))]
    : categories;

  const q = one(sp.q).slice(0, 100);
  const cat = one(sp.cat);
  const status = one(sp.status) as ProductStatus | "";
  const brand = one(sp.brand).slice(0, 120);
  const col = one(sp.col);
  const sort = (one(sp.sort) in SORTS ? one(sp.sort) : "recent") as SortId;
  const min = parseMoneyToCents(one(sp.min));
  const max = parseMoneyToCents(one(sp.max));
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const category = categories.find((c) => c.id === cat);
  const attrFilters = (category?.attribute_schema ?? [])
    .filter((a) => a.filterable)
    .map((a) => ({ def: a, value: one(sp[`a_${a.key}`]).slice(0, 100) }));

  let ids: string[] | null = null;
  if (col) {
    const { data } = await supabase.from("collection_products").select("product_id").eq("collection_id", col).eq("business_id", business.id);
    ids = (data ?? []).map((r) => r.product_id);
  }

  const like = (s: string) => `%${s.replace(/[%_,()\\]/g, " ")}%`;
  let query = supabase
    .from("products")
    .select("id, name, brand, sku, category_id, sale_type, price_cents, compare_at_cents, unit, stock_policy, stock_quantity, has_variants, status, compliance_status, product_media(file_path, sort_order), product_variants(stock_quantity, active)", { count: "exact" })
    .eq("business_id", business.id);
  if (q) query = query.or(`name.ilike.${like(q)},sku.ilike.${like(q)},brand.ilike.${like(q)},description.ilike.${like(q)}`);
  if (category) query = query.eq("category_id", category.id);
  if (status && status in PRODUCT_STATUS) query = query.eq("status", status);
  else query = query.neq("status", "archived");
  if (brand) query = query.ilike("brand", like(brand));
  if (min !== null && !Number.isNaN(min)) query = query.gte("price_cents", min);
  if (max !== null && !Number.isNaN(max)) query = query.lte("price_cents", max);
  if (ids) query = query.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  for (const f of attrFilters) {
    if (!f.value) continue;
    if (f.def.type === "multiselect") query = query.contains("attributes", { [f.def.key]: [f.value] });
    else if (f.def.type === "select" || f.def.type === "boolean") query = query.eq(`attributes->>${f.def.key}`, f.value);
    else query = query.ilike(`attributes->>${f.def.key}`, like(f.value));
  }
  query =
    sort === "name" ? query.order("name") :
    sort === "price_asc" ? query.order("price_cents") :
    sort === "price_desc" ? query.order("price_cents", { ascending: false }) :
    sort === "stock" ? query.order("stock_quantity", { ascending: true, nullsFirst: false }) :
    query.order("created_at", { ascending: false });
  const from = (page - 1) * LIMITS.pageSize;
  const { data: rows, count } = await query.range(from, from + LIMITS.pageSize - 1);

  const products = (rows ?? []).map((p) => {
    const media = [...(p.product_media ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    const stock = p.stock_policy !== "tracked" ? null : p.has_variants
      ? (p.product_variants ?? []).filter((v) => v.active).reduce((s, v) => s + (v.stock_quantity ?? 0), 0)
      : (p.stock_quantity ?? 0);
    return { ...p, cover: media[0]?.file_path ?? null, stock };
  });
  const signed = await signPaths(supabase, products.map((p) => p.cover).filter((x): x is string => Boolean(x)));

  const { data: statsRows } = await supabase.from("products").select("status").eq("business_id", business.id);
  const stats = (statsRows ?? []).reduce<Record<string, number>>((acc, r) => ((acc[r.status] = (acc[r.status] ?? 0) + 1), acc), {});
  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  const pages = Math.max(1, Math.ceil((count ?? 0) / LIMITS.pageSize));
  const filtered = Boolean(q || cat || status || brand || col || one(sp.min) || one(sp.max) || attrFilters.some((f) => f.value));

  const href = (patch: Record<string, string | number | null>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v) u.set(k, v);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") u.delete(k);
      else u.set(k, String(v));
    }
    const s = u.toString();
    return s ? `/catalogue?${s}` : "/catalogue";
  };

  return (
    <div className="mt-4 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand text-white"><Package className="size-6" /></span>
          <div>
            <h1 className="text-2xl font-semibold sm:text-3xl">Catalogue</h1>
            <p className="mt-1 text-ink-soft">
              Tous vos produits, services et contenus numériques, quel que soit votre métier.{" "}
              <Link href="/boutique" className="font-medium text-brand hover:underline">Modèle : {template.name}</Link>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/catalogue/nouveau" className="btn-ghost"><Plus className="size-4" /> Ajouter</Link>
          <Link href="/catalogue/nouveau?mode=ia" className="btn-primary"><Sparkles className="size-4" /> Créer avec l&apos;IA</Link>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Produits", total],
          ["En vente", stats.active ?? 0],
          ["À vérifier", (stats.review ?? 0) + (stats.draft ?? 0)],
          ["Archivés", stats.archived ?? 0],
        ].map(([k, v]) => (
          <div key={k as string} className="card p-4">
            <p className="text-sm text-ink-soft">{k}</p>
            <p className="mt-1 text-2xl font-semibold">{v}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="space-y-4">
          <form action="/catalogue" className="card space-y-4 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold"><SlidersHorizontal className="size-4" /> Filtres</p>
            <div>
              <label className="label" htmlFor="q">Recherche</label>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-soft" />
                <input id="q" name="q" defaultValue={q} placeholder="Nom, référence, marque…" className="input pl-9" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="cat">Catégorie</label>
              <select id="cat" name="cat" defaultValue={cat} className="input">
                <option value="">Toutes</option>
                {featured.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {attrFilters.map((f) => (
              <div key={f.def.key}>
                <label className="label" htmlFor={`a_${f.def.key}`}>{f.def.label}</label>
                {f.def.options ? (
                  <select id={`a_${f.def.key}`} name={`a_${f.def.key}`} defaultValue={f.value} className="input">
                    <option value="">Tous</option>
                    {f.def.options.map((o) => <option key={o}>{o}</option>)}
                  </select>
                ) : (
                  <input id={`a_${f.def.key}`} name={`a_${f.def.key}`} defaultValue={f.value} className="input" />
                )}
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label" htmlFor="min">Prix min.</label>
                <input id="min" name="min" inputMode="decimal" defaultValue={one(sp.min)} placeholder={market.currency} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="max">Prix max.</label>
                <input id="max" name="max" inputMode="decimal" defaultValue={one(sp.max)} placeholder={market.currency} className="input" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="brand">Marque</label>
              <input id="brand" name="brand" defaultValue={brand} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="status">Statut</label>
              <select id="status" name="status" defaultValue={status} className="input">
                <option value="">Tous (hors archivés)</option>
                {Object.entries(PRODUCT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            {collections?.length ? (
              <div>
                <label className="label" htmlFor="col">Collection</label>
                <select id="col" name="col" defaultValue={col} className="input">
                  <option value="">Toutes</option>
                  {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            ) : null}
            <div>
              <label className="label" htmlFor="sort">Trier par</label>
              <select id="sort" name="sort" defaultValue={sort} className="input">
                {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button className="btn-primary flex-1">Appliquer</button>
              {filtered ? <Link href="/catalogue" className="btn-ghost">Effacer</Link> : null}
            </div>
          </form>
          <CollectionsPanel collections={collections ?? []} />
        </aside>

        <section className="min-w-0 space-y-4">
          {total === 0 ? (
            <div className="card p-10 text-center">
              <p className="font-semibold">Votre catalogue est vide</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">
                Décrivez un produit ou ajoutez sa photo : l&apos;assistant propose la catégorie, la fiche, les caractéristiques et le
                référencement. Vous validez tout avant la mise en vente.
              </p>
              <Link href="/catalogue/nouveau?mode=ia" className="btn-primary mt-5"><Sparkles className="size-4" /> Créer ma première fiche</Link>
            </div>
          ) : products.length === 0 ? (
            <div className="card p-8 text-center text-sm text-ink-soft">Aucun produit ne correspond à ces filtres.</div>
          ) : (
            <>
              <p className="text-sm text-ink-soft">{count} produit{(count ?? 0) > 1 ? "s" : ""}</p>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {products.map((p) => {
                  const st = PRODUCT_STATUS[p.status as ProductStatus] ?? PRODUCT_STATUS.draft;
                  const url = p.cover ? signed.get(p.cover) : null;
                  return (
                    <li key={p.id}>
                      <Link href={`/catalogue/${p.id}`} className="card flex h-full gap-3 p-3 transition hover:border-brand-light">
                        <span className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-brand-soft text-brand">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {url ? <img src={url} alt="" className="size-full object-cover" /> : <ImageOff className="size-5" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{p.name}</span>
                          <span className="block truncate text-xs text-ink-soft">
                            {categories.find((c) => c.id === p.category_id)?.name}
                            {p.brand ? ` · ${p.brand}` : ""}
                          </span>
                          <span className="mt-1 flex items-baseline gap-2 text-sm">
                            <span className="font-semibold">{p.price_cents > 0 ? formatMoney(p.price_cents, market) : "Prix à définir"}</span>
                            {p.compare_at_cents ? <span className="text-xs text-ink-soft line-through">{formatMoney(p.compare_at_cents, market)}</span> : null}
                          </span>
                          <span className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                            <span className={`rounded-full px-2 py-0.5 font-medium ${st.tone}`}>{st.label}</span>
                            {p.compliance_status === "blocked" ? <span className="rounded-full bg-danger/10 px-2 py-0.5 font-medium text-danger">Vente interdite</span> : null}
                            {p.compliance_status === "to_verify" ? <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800">Conformité</span> : null}
                            <span className={`rounded-full px-2 py-0.5 ${p.stock === 0 ? "bg-danger/10 text-danger" : "bg-neutral-100 text-neutral-700"}`}>
                              {p.stock === null ? STOCK_POLICIES[p.stock_policy as keyof typeof STOCK_POLICIES] : p.stock === 0 ? "Rupture" : `Stock : ${p.stock}`}
                            </span>
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {pages > 1 ? (
                <nav className="flex items-center justify-center gap-2 text-sm">
                  {page > 1 ? <Link href={href({ page: page - 1 })} className="btn-ghost">Précédent</Link> : null}
                  <span className="text-ink-soft">Page {page} / {pages}</span>
                  {page < pages ? <Link href={href({ page: page + 1 })} className="btn-ghost">Suivant</Link> : null}
                </nav>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
