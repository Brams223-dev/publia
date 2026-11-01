"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, Ban, Camera, Check, Copy, Eye, ImagePlus, Info, Layers, Loader2, Plus, Save, ShieldCheck, Sparkles, Star, Trash2, Wand2, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { checkCompliance } from "@/config/commerce-rules";
import { customLabel, slugKey, type AttributeValue } from "@/lib/commerce/attributes";
import {
  LIMITS, PRODUCT_STATUS, SALE_TYPES, STOCK_POLICIES, UNITS,
  type AttributeDef, type Category, type ProductStatus, type SaleType, type StockPolicy, type Unit,
} from "@/lib/commerce/config";
import { centsToInput } from "@/lib/commerce/money";
import {
  addProductMedia, createCollection, deleteProduct, deleteProductMedia, duplicateProduct, saveProduct, setCoverMedia, type SavePayload,
} from "../actions";

type AiMeta = {
  declared?: string[];
  observed?: string[];
  suggestions?: { key: string; label: string; value: string; source: "observed" | "suggested" }[];
  to_verify?: string[];
  missing?: string[];
  collections?: string[];
  photo_tips?: string[];
  model?: string;
};

export type EditorProduct = {
  id: string;
  name: string;
  categoryId: string;
  saleType: SaleType;
  description: string;
  brand: string;
  sku: string;
  priceCents: number;
  compareAtCents: number | null;
  unit: Unit;
  stockPolicy: StockPolicy;
  stockQuantity: number | null;
  weightG: number | null;
  dimensions: { length_cm?: number; width_cm?: number; height_cm?: number };
  attributes: Record<string, AttributeValue>;
  hasVariants: boolean;
  variants: { options: Record<string, string>; sku: string; priceCents: number | null; stockQuantity: number | null; active: boolean }[];
  seo: { title: string; meta_description: string; keywords: string[] };
  status: ProductStatus;
  collectionIds: string[];
  complianceConfirmed: boolean;
  aiMeta: AiMeta | null;
};

type Variant = { options: Record<string, string>; sku: string; price: string; stock: string; active: boolean };
const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const toInt = (s: string) => (s.trim() === "" ? null : Math.max(0, Math.round(Number(s.replace(",", ".")))) || 0);
const str = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

function Section({ title, icon: Icon, children, aside }: { title: string; icon: React.ElementType; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="card space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold"><Icon className="size-4 text-brand" /> {title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function SourceBadge({ source }: { source: "declared" | "observed" | null }) {
  if (!source) return null;
  return source === "declared" ? (
    <span className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">Déclaré par vous</span>
  ) : (
    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">Observé sur la photo · à confirmer</span>
  );
}

export function ProductEditor({
  businessId,
  product,
  categories,
  media,
  collections: initialCollections,
  country,
  currency,
  justGenerated,
  similar,
}: {
  businessId: string;
  product: EditorProduct;
  categories: Category[];
  media: { id: string; url: string | null; origin: string }[];
  collections: { id: string; name: string }[];
  country: string;
  currency: string;
  justGenerated: boolean;
  similar: { id: string; name: string; price: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(
    justGenerated ? { type: "ok", text: "Fiche préparée par l'assistant. Vérifiez chaque information avant la mise en vente." } : null,
  );

  const [name, setName] = useState(product.name);
  const [categoryId, setCategoryId] = useState(product.categoryId);
  const [saleType, setSaleType] = useState<SaleType>(product.saleType);
  const [description, setDescription] = useState(product.description);
  const [brand, setBrand] = useState(product.brand);
  const [sku, setSku] = useState(product.sku);
  const [price, setPrice] = useState(product.priceCents > 0 ? centsToInput(product.priceCents) : "");
  const [compareAt, setCompareAt] = useState(centsToInput(product.compareAtCents));
  const [unit, setUnit] = useState<Unit>(product.unit);
  const [stockPolicy, setStockPolicy] = useState<StockPolicy>(product.stockPolicy);
  const [stock, setStock] = useState(str(product.stockQuantity));
  const [weight, setWeight] = useState(str(product.weightG));
  const [dims, setDims] = useState({ l: str(product.dimensions.length_cm), w: str(product.dimensions.width_cm), h: str(product.dimensions.height_cm) });
  const [attrs, setAttrs] = useState<Record<string, AttributeValue | string>>(product.attributes);
  const [declared, setDeclared] = useState(new Set(product.aiMeta?.declared ?? []));
  const [observed, setObserved] = useState(new Set(product.aiMeta?.observed ?? []));
  const [suggestions, setSuggestions] = useState(product.aiMeta?.suggestions ?? []);
  const [hasVariants, setHasVariants] = useState(product.hasVariants);
  const [variants, setVariants] = useState<Variant[]>(
    product.variants.map((v) => ({ options: v.options, sku: v.sku, price: centsToInput(v.priceCents), stock: str(v.stockQuantity), active: v.active })),
  );
  const [optionDefs, setOptionDefs] = useState<{ name: string; values: string }[]>(() => {
    const names = Array.from(new Set(product.variants.flatMap((v) => Object.keys(v.options))));
    return names.length
      ? names.map((n) => ({ name: n, values: Array.from(new Set(product.variants.map((v) => v.options[n]).filter(Boolean))).join(", ") }))
      : [{ name: "", values: "" }];
  });
  const [seo, setSeo] = useState({ ...product.seo, keywords: product.seo.keywords.join(", ") });
  const [status, setStatus] = useState<ProductStatus>(product.status);
  const [collections, setCollections] = useState(initialCollections);
  const [collectionIds, setCollectionIds] = useState(new Set(product.collectionIds));
  const [confirmed, setConfirmed] = useState(product.complianceConfirmed);
  const [newAttr, setNewAttr] = useState({ label: "", value: "" });
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const category = categories.find((c) => c.id === categoryId) ?? categories[0];
  const schema = category.attribute_schema;
  const customKeys = Object.keys(attrs).filter((k) => k.startsWith("custom:"));
  const compliance = useMemo(
    () => checkCompliance({ country, categoryId: category.id, regulated: category.regulated, text: [name, description, brand].join("\n"), attributes: attrs }),
    [country, category, name, description, brand, attrs],
  );
  const missing = schema.filter((d) => d.required && (attrs[d.key] === undefined || attrs[d.key] === "" || (Array.isArray(attrs[d.key]) && !(attrs[d.key] as string[]).length)));
  const saleTypes = Array.from(new Set<SaleType>([...category.sale_types, "bundle"]));

  function setAttr(key: string, value: AttributeValue | string) {
    setAttrs((a) => {
      const next = { ...a };
      if (value === "" || (Array.isArray(value) && !value.length)) delete next[key];
      else next[key] = value;
      return next;
    });
    // Une valeur modifiée par le vendeur devient une déclaration.
    setObserved((s) => (s.has(key) ? new Set([...s].filter((k) => k !== key)) : s));
    setDeclared((s) => new Set(s).add(key));
  }

  function generateVariants() {
    const defs = optionDefs
      .map((o) => ({ name: o.name.trim(), values: Array.from(new Set(o.values.split(",").map((v) => v.trim()).filter(Boolean))) }))
      .filter((o) => o.name && o.values.length);
    if (!defs.length) return setMessage({ type: "error", text: "Indiquez au moins une option et ses valeurs (ex. : Taille → S, M, L)." });
    let combos: Record<string, string>[] = [{}];
    for (const d of defs) combos = combos.flatMap((c) => d.values.map((v) => ({ ...c, [d.name]: v })));
    if (combos.length > LIMITS.variantsMax) return setMessage({ type: "error", text: `${combos.length} combinaisons : ${LIMITS.variantsMax} maximum.` });
    const key = (o: Record<string, string>) => JSON.stringify(Object.entries(o).sort());
    const existing = new Map(variants.map((v) => [key(v.options), v]));
    setVariants(combos.map((o) => existing.get(key(o)) ?? { options: o, sku: "", price: "", stock: "", active: true }));
    setMessage(null);
  }

  function payload(nextStatus: ProductStatus): SavePayload {
    return {
      id: product.id,
      name,
      categoryId,
      saleType,
      description,
      brand,
      sku,
      price,
      compareAt,
      unit,
      stockPolicy,
      stockQuantity: toInt(stock),
      weightG: toInt(weight),
      dimensions: { length_cm: toInt(dims.l), width_cm: toInt(dims.w), height_cm: toInt(dims.h) },
      attributes: attrs,
      hasVariants,
      variants: variants.map((v) => ({ options: v.options, sku: v.sku.trim(), price: v.price, stockQuantity: toInt(v.stock), active: v.active })),
      seo: { title: seo.title, meta_description: seo.meta_description, keywords: seo.keywords.split(",").map((k) => k.trim()).filter(Boolean).slice(0, 10) },
      collectionIds: [...collectionIds],
      complianceConfirmed: confirmed,
      status: nextStatus,
    };
  }

  function save(nextStatus: ProductStatus = status) {
    setMessage(null);
    start(async () => {
      const r = await saveProduct(payload(nextStatus));
      if (r.error) setMessage({ type: "error", text: r.error });
      else {
        setStatus(nextStatus);
        setMessage({ type: "ok", text: nextStatus === "active" ? "Produit enregistré et marqué « Actif »." : "Modifications enregistrées." });
        router.refresh();
      }
    });
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setMessage(null);
    const supabase = createClient();
    for (const file of Array.from(files).slice(0, LIMITS.mediaMax - media.length)) {
      if (!(LIMITS.mediaTypes as readonly string[]).includes(file.type) || file.size > LIMITS.mediaMaxBytes) {
        setMessage({ type: "error", text: "Photo ignorée : PNG, JPG ou WebP de 15 Mo maximum." });
        continue;
      }
      const path = `${businessId}/products/${crypto.randomUUID()}.${EXT[file.type]}`;
      const { error } = await supabase.storage.from("uploads").upload(path, file, { contentType: file.type });
      if (error) {
        setMessage({ type: "error", text: "L'envoi d'une photo a échoué." });
        continue;
      }
      const r = await addProductMedia(product.id, path);
      if (r.error) setMessage({ type: "error", text: r.error });
    }
    setUploading(false);
    if (fileInput.current) fileInput.current.value = "";
    router.refresh();
  }

  function addCollectionByName(n: string) {
    start(async () => {
      const r = await createCollection(n);
      if (r.error || !r.id) return setMessage({ type: "error", text: r.error ?? "Collection non créée." });
      const id = r.id;
      setCollections((c) => (c.some((x) => x.id === id) ? c : [...c, { id, name: n.trim() }]));
      setCollectionIds((s) => new Set(s).add(id));
    });
  }

  function renderAttr(def: AttributeDef) {
    const v = attrs[def.key];
    const id = `attr-${def.key}`;
    const source = declared.has(def.key) && v !== undefined ? "declared" : observed.has(def.key) && v !== undefined ? "observed" : null;
    let field: React.ReactNode;
    switch (def.type) {
      case "textarea":
        field = <textarea id={id} rows={3} className="input" value={String(v ?? "")} onChange={(e) => setAttr(def.key, e.target.value)} />;
        break;
      case "number":
        field = (
          <div className="flex items-center gap-2">
            <input id={id} inputMode="decimal" className="input" value={String(v ?? "")} onChange={(e) => setAttr(def.key, e.target.value)} />
            {def.unit ? <span className="shrink-0 text-sm text-ink-soft">{def.unit}</span> : null}
          </div>
        );
        break;
      case "select":
        field = (
          <select id={id} className="input" value={String(v ?? "")} onChange={(e) => setAttr(def.key, e.target.value)}>
            <option value="">—</option>
            {def.options?.map((o) => <option key={o}>{o}</option>)}
          </select>
        );
        break;
      case "multiselect": {
        const list = Array.isArray(v) ? v : [];
        field = (
          <div className="flex flex-wrap gap-1.5">
            {def.options?.map((o) => {
              const on = list.includes(o);
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => setAttr(def.key, on ? list.filter((x) => x !== o) : [...list, o])}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${on ? "border-brand bg-brand text-white" : "border-line bg-white text-ink-soft hover:border-brand-light"}`}
                >
                  {o}
                </button>
              );
            })}
          </div>
        );
        break;
      }
      case "boolean":
        field = (
          <select id={id} className="input" value={v === true ? "true" : v === false ? "false" : ""} onChange={(e) => setAttr(def.key, e.target.value === "" ? "" : e.target.value === "true")}>
            <option value="">—</option>
            <option value="true">Oui</option>
            <option value="false">Non</option>
          </select>
        );
        break;
      case "date":
        field = <input id={id} type="date" className="input" value={String(v ?? "")} onChange={(e) => setAttr(def.key, e.target.value)} />;
        break;
      default:
        field = <input id={id} className="input" value={String(v ?? "")} onChange={(e) => setAttr(def.key, e.target.value)} />;
    }
    return (
      <div key={def.key} className={def.type === "textarea" || def.type === "multiselect" ? "sm:col-span-2" : ""}>
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <label htmlFor={id} className="text-sm font-medium">
            {def.label}
            {def.required ? <span className="text-danger"> *</span> : null}
          </label>
          <SourceBadge source={source} />
        </div>
        {field}
      </div>
    );
  }

  const st = PRODUCT_STATUS[status];
  const ai = product.aiMeta;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-6">
        {ai ? (
          <Section title="Assistant IA" icon={Sparkles}>
            <p className="text-sm text-ink-soft">
              Les caractéristiques marquées « Déclaré par vous » viennent de votre description ; celles « Observé sur la photo » sont
              à confirmer. Les suggestions ci-dessous ne sont pas enregistrées tant que vous ne les acceptez pas.
            </p>
            {ai.to_verify?.length ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-amber-900"><AlertTriangle className="size-4" /> À vérifier ou compléter</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-amber-900">
                  {ai.to_verify.map((t) => <li key={t}>{t}</li>)}
                </ul>
              </div>
            ) : null}
            {suggestions.length ? (
              <div>
                <p className="text-sm font-semibold">Suggestions non vérifiées</p>
                <ul className="mt-2 space-y-2">
                  {suggestions.map((s) => (
                    <li key={s.key} className="flex flex-wrap items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm">
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">{s.label} :</span> {s.value}{" "}
                        <span className="text-xs text-ink-soft">({s.source === "observed" ? "vu sur la photo" : "supposition de l'IA"})</span>
                      </span>
                      <button
                        type="button"
                        className="btn-ghost px-3 py-1 text-xs"
                        onClick={() => {
                          const def = schema.find((d) => d.key === s.key);
                          setAttr(s.key, def?.type === "multiselect" ? s.value.split(",").map((x) => x.trim()) : s.value);
                          setSuggestions((l) => l.filter((x) => x.key !== s.key));
                        }}
                      >
                        <Check className="size-3.5" /> C&apos;est exact
                      </button>
                      <button type="button" className="rounded-full p-1 text-ink-soft hover:text-danger" aria-label="Ignorer" onClick={() => setSuggestions((l) => l.filter((x) => x.key !== s.key))}>
                        <X className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {ai.collections?.length ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">Collections suggérées :</span>
                {ai.collections.map((c) => {
                  const exists = collections.find((x) => x.name.toLowerCase() === c.toLowerCase());
                  const on = exists && collectionIds.has(exists.id);
                  return (
                    <button key={c} type="button" disabled={Boolean(on) || pending} onClick={() => addCollectionByName(c)} className="rounded-full border border-line px-3 py-1 text-xs hover:border-brand-light disabled:opacity-60">
                      {on ? <Check className="mr-1 inline size-3" /> : <Plus className="mr-1 inline size-3" />}
                      {c}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </Section>
        ) : null}

        <Section title="Informations générales" icon={Info}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="name">Nom</label>
              <input id="name" className="input" maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="category">Catégorie</label>
              <select
                id="category"
                className="input"
                value={categoryId}
                onChange={(e) => {
                  const c = categories.find((x) => x.id === e.target.value);
                  setCategoryId(e.target.value);
                  if (c && !c.sale_types.includes(saleType) && saleType !== "bundle") setSaleType(c.sale_types[0]);
                }}
              >
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}{c.regulated ? " (réglementée)" : ""}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="saleType">Type de vente</label>
              <select id="saleType" className="input" value={saleType} onChange={(e) => setSaleType(e.target.value as SaleType)}>
                {saleTypes.map((t) => <option key={t} value={t}>{SALE_TYPES[t].label}</option>)}
              </select>
              <p className="mt-1 text-xs text-ink-soft">{SALE_TYPES[saleType].hint}</p>
            </div>
            <div>
              <label className="label" htmlFor="brand">Marque</label>
              <input id="brand" className="input" maxLength={120} value={brand} onChange={(e) => setBrand(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="sku">Référence (SKU)</label>
              <input id="sku" className="input" maxLength={80} value={sku} onChange={(e) => setSku(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="description">Description</label>
              <textarea id="description" rows={6} maxLength={5000} className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
        </Section>

        <Section title="Photos" icon={Camera} aside={<span className="text-xs text-ink-soft">{media.length} / {LIMITS.mediaMax}</span>}>
          <div className="flex flex-wrap gap-3">
            {media.map((m, i) => (
              <div key={m.id} className="group relative size-28 overflow-hidden rounded-xl border border-line bg-brand-soft">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {m.url ? <img src={m.url} alt="" className="size-full object-cover" /> : null}
                {i === 0 ? <span className="absolute bottom-1 left-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold">Principale</span> : null}
                <div className="absolute top-1 right-1 flex gap-1">
                  {i > 0 ? (
                    <button type="button" aria-label="Définir comme photo principale" onClick={() => start(async () => { await setCoverMedia(m.id); router.refresh(); })} className="grid size-7 place-items-center rounded-full bg-white/90 shadow">
                      <Star className="size-3.5" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    aria-label="Supprimer la photo"
                    onClick={() => start(async () => { await deleteProductMedia(m.id); router.refresh(); })}
                    className="grid size-7 place-items-center rounded-full bg-white/90 text-danger shadow"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {media.length < LIMITS.mediaMax ? (
              <button type="button" onClick={() => fileInput.current?.click()} disabled={uploading} className="grid size-28 place-items-center rounded-xl border border-dashed border-line text-ink-soft hover:border-brand hover:text-brand">
                {uploading ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
              </button>
            ) : null}
          </div>
          <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => onFiles(e.target.files)} />
          {ai?.photo_tips?.length ? (
            <div className="rounded-xl bg-brand-soft p-3 text-sm">
              <p className="flex items-center gap-2 font-semibold"><Wand2 className="size-4 text-brand" /> Conseils pour de meilleures photos</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink-soft">{ai.photo_tips.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
          ) : null}
          <p className="text-xs text-ink-soft">
            Pour une mise en scène (fond, texte, format réseaux sociaux), utilisez le <Link href="/studio" className="text-brand hover:underline">Studio créatif</Link>.
            L&apos;amélioration automatique des photos produit sera proposée avec les outils Fashion AI.
          </p>
        </Section>

        <Section title="Prix et stock" icon={Layers}>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="price">Prix de vente ({currency})</label>
              <input id="price" inputMode="decimal" className="input" placeholder="0,00" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="compareAt">Prix barré (facultatif)</label>
              <input id="compareAt" inputMode="decimal" className="input" value={compareAt} onChange={(e) => setCompareAt(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="unit">Vendu</label>
              <select id="unit" className="input" value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
                {Object.entries(UNITS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="stockPolicy">Disponibilité</label>
              <select id="stockPolicy" className="input" value={stockPolicy} onChange={(e) => setStockPolicy(e.target.value as StockPolicy)}>
                {Object.entries(STOCK_POLICIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {stockPolicy === "tracked" && !hasVariants ? (
              <div>
                <label className="label" htmlFor="stock">Quantité en stock</label>
                <input id="stock" inputMode="numeric" className="input" value={stock} onChange={(e) => setStock(e.target.value)} />
              </div>
            ) : null}
            {saleType !== "digital" && saleType !== "service" && saleType !== "booking" ? (
              <>
                <div>
                  <label className="label" htmlFor="weight">Poids (g)</label>
                  <input id="weight" inputMode="numeric" className="input" value={weight} onChange={(e) => setWeight(e.target.value)} />
                </div>
                <div className="sm:col-span-3">
                  <p className="label">Dimensions du colis (cm)</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(["l", "w", "h"] as const).map((k) => (
                      <input key={k} inputMode="numeric" aria-label={{ l: "Longueur", w: "Largeur", h: "Hauteur" }[k]} placeholder={{ l: "Longueur", w: "Largeur", h: "Hauteur" }[k]} className="input" value={dims[k]} onChange={(e) => setDims((d) => ({ ...d, [k]: e.target.value }))} />
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </Section>

        <Section
          title={`Caractéristiques · ${category.name}`}
          icon={Layers}
          aside={missing.length ? <span className="text-xs text-danger">{missing.length} obligatoire{missing.length > 1 ? "s" : ""} manquant{missing.length > 1 ? "s" : ""}</span> : null}
        >
          {schema.length ? <div className="grid gap-4 sm:grid-cols-2">{schema.map(renderAttr)}</div> : <p className="text-sm text-ink-soft">Cette catégorie n&apos;a pas de caractéristiques prédéfinies : ajoutez les vôtres ci-dessous.</p>}
          {customKeys.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {customKeys.map((k) => (
                <div key={k}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-sm font-medium">{customLabel(k)}</span>
                    <button type="button" aria-label="Retirer" onClick={() => setAttr(k, "")} className="text-ink-soft hover:text-danger"><X className="size-4" /></button>
                  </div>
                  <input className="input" maxLength={300} value={String(attrs[k] ?? "")} onChange={(e) => setAttr(k, e.target.value)} />
                </div>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap items-end gap-2 border-t border-line pt-4">
            <div className="min-w-[10rem] flex-1">
              <label className="label" htmlFor="newAttrLabel">Autre caractéristique</label>
              <input id="newAttrLabel" className="input" placeholder="Ex. : Doublure" value={newAttr.label} onChange={(e) => setNewAttr((a) => ({ ...a, label: e.target.value }))} />
            </div>
            <div className="min-w-[10rem] flex-1">
              <input aria-label="Valeur" className="input" placeholder="Valeur" value={newAttr.value} onChange={(e) => setNewAttr((a) => ({ ...a, value: e.target.value }))} />
            </div>
            <button
              type="button"
              className="btn-ghost"
              disabled={!slugKey(newAttr.label) || !newAttr.value.trim()}
              onClick={() => {
                setAttr(`custom:${slugKey(newAttr.label)}`, newAttr.value.trim());
                setNewAttr({ label: "", value: "" });
              }}
            >
              <Plus className="size-4" /> Ajouter
            </button>
          </div>
        </Section>

        <Section
          title="Variantes"
          icon={Copy}
          aside={
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={hasVariants} onChange={(e) => setHasVariants(e.target.checked)} className="size-4 accent-brand" />
              Ce produit a des variantes
            </label>
          }
        >
          {hasVariants ? (
            <>
              <p className="text-sm text-ink-soft">Par exemple Taille → S, M, L et Couleur → Noir, Blanc. Chaque combinaison a sa référence, son prix et son stock.</p>
              <div className="space-y-2">
                {optionDefs.map((o, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)_auto]">
                    <input aria-label="Nom de l'option" className="input" placeholder="Option (ex. : Taille)" value={o.name} onChange={(e) => setOptionDefs((l) => l.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                    <input aria-label="Valeurs" className="input" placeholder="Valeurs séparées par des virgules" value={o.values} onChange={(e) => setOptionDefs((l) => l.map((x, j) => (j === i ? { ...x, values: e.target.value } : x)))} />
                    <button type="button" aria-label="Retirer l'option" className="btn-ghost px-3" onClick={() => setOptionDefs((l) => (l.length > 1 ? l.filter((_, j) => j !== i) : [{ name: "", values: "" }]))}><X className="size-4" /></button>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {optionDefs.length < 3 ? <button type="button" className="btn-ghost" onClick={() => setOptionDefs((l) => [...l, { name: "", values: "" }])}><Plus className="size-4" /> Option</button> : null}
                <button type="button" className="btn-primary" onClick={generateVariants}>Générer les combinaisons</button>
              </div>
              {variants.length ? (
                <div className="-mx-5 overflow-x-auto px-5">
                  <table className="w-full min-w-[36rem] text-sm">
                    <thead>
                      <tr className="text-left text-xs text-ink-soft">
                        <th className="py-2 pr-2 font-medium">Variante</th>
                        <th className="py-2 pr-2 font-medium">Référence</th>
                        <th className="py-2 pr-2 font-medium">Prix ({currency})</th>
                        {stockPolicy === "tracked" ? <th className="py-2 pr-2 font-medium">Stock</th> : null}
                        <th className="py-2 font-medium">Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variants.map((v, i) => {
                        const upd = (patch: Partial<Variant>) => setVariants((l) => l.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                        return (
                          <tr key={JSON.stringify(v.options)} className="border-t border-line">
                            <td className="py-2 pr-2 font-medium">{Object.values(v.options).join(" · ")}</td>
                            <td className="py-2 pr-2"><input aria-label="Référence" className="input py-2" value={v.sku} onChange={(e) => upd({ sku: e.target.value })} /></td>
                            <td className="py-2 pr-2"><input aria-label="Prix" inputMode="decimal" className="input py-2" placeholder={price || "Prix du produit"} value={v.price} onChange={(e) => upd({ price: e.target.value })} /></td>
                            {stockPolicy === "tracked" ? <td className="py-2 pr-2"><input aria-label="Stock" inputMode="numeric" className="input w-24 py-2" value={v.stock} onChange={(e) => upd({ stock: e.target.value })} /></td> : null}
                            <td className="py-2"><input type="checkbox" aria-label="Variante active" checked={v.active} onChange={(e) => upd({ active: e.target.checked })} className="size-4 accent-brand" /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-ink-soft">Produit simple : un seul prix et un seul stock.</p>
          )}
        </Section>

        <Section title="Référencement (SEO)" icon={Eye}>
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="seoTitle">Titre de la page <span className="font-normal text-ink-soft">({seo.title.length}/70)</span></label>
              <input id="seoTitle" maxLength={70} className="input" value={seo.title} onChange={(e) => setSeo((s) => ({ ...s, title: e.target.value }))} />
            </div>
            <div>
              <label className="label" htmlFor="seoDesc">Méta-description <span className="font-normal text-ink-soft">({seo.meta_description.length}/160)</span></label>
              <textarea id="seoDesc" rows={2} maxLength={160} className="input" value={seo.meta_description} onChange={(e) => setSeo((s) => ({ ...s, meta_description: e.target.value }))} />
            </div>
            <div>
              <label className="label" htmlFor="seoKw">Mots-clés (séparés par des virgules)</label>
              <input id="seoKw" className="input" value={seo.keywords} onChange={(e) => setSeo((s) => ({ ...s, keywords: e.target.value }))} />
            </div>
          </div>
        </Section>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
        <div className="card space-y-3 p-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold">Statut</p>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.tone}`}>{st.label}</span>
          </div>
          <select aria-label="Statut" className="input" value={status} onChange={(e) => setStatus(e.target.value as ProductStatus)}>
            {Object.entries(PRODUCT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <button type="button" className="btn-primary w-full" disabled={pending} onClick={() => save()}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Enregistrer
          </button>
          {status !== "active" ? (
            <button type="button" className="btn-ghost w-full" disabled={pending || compliance.level === "blocked"} onClick={() => save("active")}>
              <Check className="size-4" /> Enregistrer et activer
            </button>
          ) : null}
          <p className="text-xs text-ink-soft">
            « Actif » signifie prêt à la vente dans votre catalogue. La boutique en ligne publique et le paiement ne sont pas encore
            ouverts : aucun client ne peut commander pour l&apos;instant.
          </p>
          {message ? <p className={`text-sm ${message.type === "error" ? "text-danger" : "text-success"}`}>{message.text}</p> : null}
        </div>

        <div className={`card space-y-3 p-4 ${compliance.level === "blocked" ? "border-danger/40" : ""}`}>
          <p className="flex items-center gap-2 font-semibold">
            {compliance.level === "blocked" ? <Ban className="size-4 text-danger" /> : <ShieldCheck className={`size-4 ${compliance.level === "ok" ? "text-success" : "text-amber-700"}`} />}
            Conformité
          </p>
          {compliance.level === "ok" ? <p className="text-sm text-ink-soft">Aucun contrôle particulier pour ce produit.</p> : null}
          {compliance.reasons.length ? <ul className="list-disc space-y-1 pl-5 text-sm">{compliance.reasons.map((r) => <li key={r}>{r}</li>)}</ul> : null}
          {compliance.level === "blocked" ? <p className="text-sm font-medium text-danger">Ce produit ne peut pas être mis en vente via Publia.</p> : null}
          {compliance.level === "to_verify" ? (
            <>
              <ul className="space-y-1.5 text-sm">
                {compliance.checklist.map((c) => <li key={c} className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-ink-soft" /> {c}</li>)}
              </ul>
              <label className="flex items-start gap-2 rounded-xl bg-brand-soft p-3 text-sm">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 size-4 accent-brand" />
                Je confirme avoir vérifié chacun de ces points.
              </label>
            </>
          ) : null}
        </div>

        <div className="card space-y-3 p-4">
          <p className="font-semibold">Collections</p>
          {collections.length ? (
            <div className="flex flex-wrap gap-1.5">
              {collections.map((c) => {
                const on = collectionIds.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCollectionIds((s) => { const n = new Set(s); if (on) n.delete(c.id); else n.add(c.id); return n; })}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${on ? "border-brand bg-brand text-white" : "border-line text-ink-soft hover:border-brand-light"}`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-ink-soft">Aucune collection. Créez-en depuis le catalogue.</p>
          )}
        </div>

        {similar.length ? (
          <div className="card space-y-2 p-4">
            <p className="font-semibold">Produits similaires</p>
            <ul className="space-y-1 text-sm">
              {similar.map((s) => (
                <li key={s.id} className="flex justify-between gap-2">
                  <Link href={`/catalogue/${s.id}`} className="min-w-0 truncate hover:text-brand">{s.name}</Link>
                  <span className="shrink-0 text-ink-soft">{s.price}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="card flex flex-wrap gap-2 p-4">
          <button type="button" className="btn-ghost flex-1" disabled={pending} onClick={() => start(async () => { await duplicateProduct(product.id); })}>
            <Copy className="size-4" /> Dupliquer
          </button>
          <button
            type="button"
            className="btn-ghost flex-1 text-danger hover:border-danger hover:text-danger"
            disabled={pending}
            onClick={() => {
              if (window.confirm("Supprimer définitivement ce produit, ses variantes et ses photos ?")) start(async () => { await deleteProduct(product.id); });
            }}
          >
            <Trash2 className="size-4" /> Supprimer
          </button>
        </div>
      </aside>
    </div>
  );
}
