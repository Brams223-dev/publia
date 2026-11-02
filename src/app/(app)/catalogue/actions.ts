"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { reportError } from "@/lib/observability";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCurrentBusiness } from "@/lib/business";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { AIError, isAIConfigured } from "@/lib/ai";
import { getCategories, signPaths } from "@/lib/commerce/catalog";
import { generateProductDraft } from "@/lib/commerce/generate";
import { validateAttributes } from "@/lib/commerce/attributes";
import { checkCompliance } from "@/config/commerce-rules";
import { LIMITS, SALE_TYPE_IDS, SHOP_TEMPLATES, STOCK_POLICY_IDS, UNIT_IDS, type SaleType, type StockPolicy, type Unit } from "@/lib/commerce/config";
import { parseMoneyToCents } from "@/lib/commerce/money";

type Result = { error?: string; ok?: boolean };
export type FormState = { error?: string } | undefined;

const ownsPath = (path: string, bid: string) => path.startsWith(`${bid}/products/`) && !path.includes("..");

const AI_ERRORS: Record<AIError["kind"], string> = {
  config: "La connexion à l'IA n'est pas encore configurée. Aucun crédit n'a été utilisé.",
  timeout: "La génération a pris trop de temps. Réessayez : aucun crédit n'a été utilisé.",
  refusal: "L'IA n'a pas pu traiter cette demande. Reformulez-la : aucun crédit n'a été utilisé.",
  rate_limit: "Le service d'IA est très sollicité. Réessayez dans une minute : aucun crédit n'a été utilisé.",
  upstream: "Le service d'IA est momentanément indisponible : aucun crédit n'a été utilisé.",
  invalid: "La réponse de l'IA était incomplète. Réessayez : aucun crédit n'a été utilisé.",
};

// ---------------------------------------------------------------------------
// Création manuelle
// ---------------------------------------------------------------------------
const manualSchema = z.object({
  name: z.string().trim().min(2, "Indiquez le nom du produit.").max(200),
  categoryId: z.string().min(2, "Choisissez une catégorie."),
});

export async function createProduct(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = manualSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { supabase, user, business } = await getCurrentBusiness();
  if (!user) return { error: "Session expirée." };
  if (!business) return { error: "Renseignez d'abord votre commerce." };
  const limited = await checkRateLimit(supabase, "write");
  if (limited) return { error: limited };

  const cat = (await getCategories(supabase)).find((c) => c.id === parsed.data.categoryId);
  if (!cat) return { error: "Catégorie inconnue." };

  const { data, error } = await supabase
    .from("products")
    .insert({
      business_id: business.id,
      category_id: cat.id,
      sale_type: cat.sale_types[0] ?? "physical",
      name: parsed.data.name,
      price_cents: 0,
      currency: business.currency,
      stock_policy: cat.sale_types[0] === "digital" || cat.sale_types[0] === "service" ? "untracked" : "tracked",
    })
    .select("id")
    .single();
  if (error || !data) return { error: "Le produit n'a pas pu être créé." };
  revalidatePath("/catalogue");
  redirect(`/catalogue/${data.id}`);
}

// ---------------------------------------------------------------------------
// Assistant IA : fiche produit à partir du texte du vendeur et de ses photos
// ---------------------------------------------------------------------------
const aiSchema = z.object({
  text: z.string().trim().min(15, "Décrivez le produit en quelques mots (au moins 15 caractères).").max(3000),
  categoryId: z.string().transform((v) => (v === "" ? null : v)),
  paths: z.string().transform((v) => (v ? v.split("\n").filter(Boolean) : [])),
  requestId: z.string().uuid(),
});

export async function generateProduct(_: FormState, formData: FormData): Promise<FormState> {
  if (!isAIConfigured() || !isAdminConfigured()) return { error: "L'assistant n'est pas encore activé : configuration serveur incomplète." };
  const parsed = aiSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const { supabase, user, business } = await getCurrentBusiness();
  if (!user) return { error: "Session expirée." };
  if (!business) return { error: "Renseignez d'abord votre commerce." };
  const limited = await checkRateLimit(supabase, "ai");
  if (limited) return { error: limited };
  if (d.paths.length > 4 || d.paths.some((p) => !ownsPath(p, business.id))) return { error: "Photos non autorisées." };

  const categories = await getCategories(supabase);
  if (d.categoryId && !categories.some((c) => c.id === d.categoryId)) return { error: "Catégorie inconnue." };

  const signed = await signPaths(supabase, d.paths, 600);
  const images = d.paths.map((p) => signed.get(p)).filter((u): u is string => Boolean(u));

  const admin = createAdminClient();
  const key = `product:${d.requestId}`;
  const { data: quota, error: qErr } = await admin.rpc("consume_generation", {
    p_user: user.id,
    p_business: business.id,
    p_action: "generate_product",
    p_key: key,
  });
  if (qErr) return { error: "Vérification des crédits impossible. Réessayez." };
  if (!quota?.ok) {
    if (quota?.reason === "quota") return { error: `Vous avez utilisé vos ${quota.quota} générations du mois (offre ${quota.plan}).` };
    if (quota?.reason === "duplicate") return { error: "Cette demande est déjà en cours." };
    return { error: "Commerce introuvable." };
  }

  let gen: Awaited<ReturnType<typeof generateProductDraft>>;
  try {
    gen = await generateProductDraft({ business, userId: user.id, categories, sellerText: d.text, categoryId: d.categoryId, images });
  } catch (e) {
    await admin.rpc("refund_generation", { p_user: user.id, p_key: key });
    await reportError("action", "generateProduct", e, { userId: user.id });
    return { error: e instanceof AIError ? AI_ERRORS[e.kind] : AI_ERRORS.invalid };
  }

  const cat = categories.find((c) => c.id === gen.draft.category_id)!;
  const compliance = checkCompliance({
    country: business.country_code,
    categoryId: cat.id,
    regulated: cat.regulated,
    text: [gen.draft.name, gen.draft.description, d.text].join("\n"),
    attributes: gen.draft.attributes,
  });

  const { data: product, error } = await supabase
    .from("products")
    .insert({
      business_id: business.id,
      category_id: cat.id,
      sale_type: gen.draft.sale_type,
      name: gen.draft.name,
      description: gen.draft.description,
      brand: gen.draft.brand || null,
      price_cents: 0,
      currency: business.currency,
      stock_policy: gen.draft.sale_type === "digital" || gen.draft.sale_type === "service" ? "untracked" : "tracked",
      attributes: gen.draft.attributes,
      seo: gen.draft.seo,
      status: "review",
      compliance_status: compliance.level,
      compliance: { level: compliance.level, reasons: compliance.reasons, checklist: compliance.checklist, confirmed: false, country: business.country_code },
      ai_meta: { ...gen.meta, seller_text: d.text, model: gen.model, generated_at: new Date().toISOString() },
    })
    .select("id")
    .single();

  if (error || !product) {
    await admin.rpc("refund_generation", { p_user: user.id, p_key: key });
    await reportError("action", "generateProduct.insert", error, { userId: user.id });
    return { error: "La fiche n'a pas pu être enregistrée. Aucun crédit n'a été utilisé." };
  }

  if (d.paths.length)
    await supabase
      .from("product_media")
      .insert(d.paths.map((p, i) => ({ product_id: product.id, business_id: business.id, file_path: p, sort_order: i })));

  revalidatePath("/catalogue");
  redirect(`/catalogue/${product.id}?ia=1`);
}

// ---------------------------------------------------------------------------
// Enregistrement de la fiche complète
// ---------------------------------------------------------------------------
const optInt = z.union([z.number().int().min(0).max(1e9), z.null()]);
const saveSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Le nom est obligatoire.").max(200),
  categoryId: z.string(),
  saleType: z.enum(SALE_TYPE_IDS as [SaleType, ...SaleType[]]),
  description: z.string().trim().max(5000, "Description : 5 000 caractères maximum."),
  brand: z.string().trim().max(120),
  sku: z.string().trim().max(80),
  price: z.string(),
  compareAt: z.string(),
  unit: z.enum(UNIT_IDS as [Unit, ...Unit[]]),
  stockPolicy: z.enum(STOCK_POLICY_IDS as [StockPolicy, ...StockPolicy[]]),
  stockQuantity: optInt,
  weightG: optInt,
  dimensions: z.object({ length_cm: optInt, width_cm: optInt, height_cm: optInt }),
  attributes: z.record(z.string(), z.unknown()),
  hasVariants: z.boolean(),
  variants: z
    .array(
      z.object({
        options: z.record(z.string().trim().min(1).max(40), z.string().trim().min(1).max(60)),
        sku: z.string().trim().max(80),
        price: z.string(),
        stockQuantity: optInt,
        active: z.boolean(),
      }),
    )
    .max(LIMITS.variantsMax, `${LIMITS.variantsMax} variantes maximum.`),
  seo: z.object({ title: z.string().trim().max(70), meta_description: z.string().trim().max(160), keywords: z.array(z.string().trim().max(60)).max(10) }),
  collectionIds: z.array(z.string().uuid()).max(LIMITS.collectionsMax),
  complianceConfirmed: z.boolean(),
  status: z.enum(["draft", "review", "active", "archived"]),
});
export type SavePayload = z.infer<typeof saveSchema>;

export async function saveProduct(payload: SavePayload): Promise<Result> {
  const parsed = saveSchema.safeParse(payload);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const { supabase, user, business } = await getCurrentBusiness();
  if (!user || !business) return { error: "Session expirée." };
  const limited = await checkRateLimit(supabase, "write");
  if (limited) return { error: limited };

  const { data: existing } = await supabase
    .from("products")
    .select("id, compliance")
    .eq("id", d.id)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!existing) return { error: "Produit introuvable." };

  const cat = (await getCategories(supabase)).find((c) => c.id === d.categoryId);
  if (!cat) return { error: "Catégorie inconnue." };
  if (!cat.sale_types.includes(d.saleType) && d.saleType !== "bundle")
    return { error: `Ce type de vente n'est pas proposé pour la catégorie « ${cat.name} ».` };

  const price = parseMoneyToCents(d.price);
  if (price === null || Number.isNaN(price)) return { error: "Indiquez un prix valide (ex. : 19,90)." };
  const compareAt = parseMoneyToCents(d.compareAt);
  if (Number.isNaN(compareAt)) return { error: "Prix barré invalide." };
  if (compareAt !== null && compareAt <= price) return { error: "Le prix barré doit être supérieur au prix de vente." };

  const publishing = d.status === "active";
  if (publishing && price <= 0) return { error: "Indiquez un prix avant de mettre le produit en vente." };

  const attrs = validateAttributes(cat.attribute_schema, d.attributes, { allowMissingRequired: !publishing });
  if (attrs.errors.length) return { error: attrs.errors[0] };

  // Variantes : options cohérentes, prix valides, références uniques.
  const variants = d.hasVariants ? d.variants : [];
  if (d.hasVariants && !variants.length) return { error: "Ajoutez au moins une variante, ou désactivez les variantes." };
  const seen = new Set<string>();
  const skus = new Set<string>();
  const variantRows = [];
  for (const [i, v] of variants.entries()) {
    const sig = JSON.stringify(Object.entries(v.options).sort());
    if (seen.has(sig)) return { error: `Variante ${i + 1} : cette combinaison existe déjà.` };
    seen.add(sig);
    const vp = parseMoneyToCents(v.price);
    if (Number.isNaN(vp)) return { error: `Variante ${i + 1} : prix invalide.` };
    if (v.sku) {
      if (skus.has(v.sku) || v.sku === d.sku) return { error: `Référence « ${v.sku} » utilisée plusieurs fois.` };
      skus.add(v.sku);
    }
    variantRows.push({
      product_id: d.id,
      business_id: business.id,
      options: v.options,
      sku: v.sku || null,
      price_cents: vp,
      stock_quantity: d.stockPolicy === "tracked" ? (v.stockQuantity ?? 0) : null,
      active: v.active,
      sort_order: i,
    });
  }

  // Conformité : recalculée à chaque enregistrement, jamais reprise du client.
  const compliance = checkCompliance({
    country: business.country_code,
    categoryId: cat.id,
    regulated: cat.regulated,
    text: [d.name, d.description, d.brand].join("\n"),
    attributes: attrs.values,
  });
  if (publishing && compliance.level === "blocked")
    return { error: `Ce produit ne peut pas être mis en vente : ${compliance.reasons[0] ?? "catégorie interdite."}` };
  if (publishing && compliance.level === "to_verify" && !d.complianceConfirmed)
    return { error: "Confirmez les vérifications de conformité avant de mettre ce produit en vente." };

  const prev = (existing.compliance ?? {}) as { confirmed_at?: string };
  const confirmed = compliance.level === "to_verify" && d.complianceConfirmed;

  const { error } = await supabase
    .from("products")
    .update({
      category_id: cat.id,
      sale_type: d.saleType,
      name: d.name,
      description: d.description || null,
      brand: d.brand || null,
      sku: d.sku || null,
      price_cents: price,
      compare_at_cents: compareAt,
      unit: d.unit,
      stock_policy: d.stockPolicy,
      stock_quantity: d.stockPolicy === "tracked" && !d.hasVariants ? (d.stockQuantity ?? 0) : null,
      weight_g: d.weightG,
      dimensions: Object.fromEntries(Object.entries(d.dimensions).filter(([, v]) => v !== null)),
      attributes: attrs.values,
      has_variants: d.hasVariants,
      seo: { ...d.seo, keywords: Array.from(new Set(d.seo.keywords.filter(Boolean))) },
      status: d.status,
      compliance_status: compliance.level,
      compliance: {
        level: compliance.level,
        reasons: compliance.reasons,
        checklist: compliance.checklist,
        confirmed,
        confirmed_at: confirmed ? (prev.confirmed_at ?? new Date().toISOString()) : null,
        country: business.country_code,
      },
    })
    .eq("id", d.id);
  if (error) {
    if (error.code === "23505") return { error: "Cette référence (SKU) est déjà utilisée par un autre produit." };
    await reportError("action", "saveProduct", error, { userId: user.id });
    return { error: "Enregistrement impossible. Réessayez." };
  }

  await supabase.from("product_variants").delete().eq("product_id", d.id);
  if (variantRows.length) {
    const { error: vErr } = await supabase.from("product_variants").insert(variantRows);
    if (vErr) return { error: vErr.code === "23505" ? "Une référence de variante est déjà utilisée par un autre produit." : "Les variantes n'ont pas pu être enregistrées." };
  }

  // Collections : uniquement celles du commerce.
  const { data: own } = await supabase.from("collections").select("id").eq("business_id", business.id);
  const allowed = new Set((own ?? []).map((c) => c.id));
  await supabase.from("collection_products").delete().eq("product_id", d.id);
  const links = d.collectionIds.filter((c) => allowed.has(c)).map((c) => ({ collection_id: c, product_id: d.id, business_id: business.id }));
  if (links.length) await supabase.from("collection_products").insert(links);

  revalidatePath("/catalogue");
  revalidatePath(`/catalogue/${d.id}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Médias, suppression, duplication
// ---------------------------------------------------------------------------
async function ownedProduct(id: string) {
  const ctx = await getCurrentBusiness();
  if (!ctx.user || !ctx.business) return { ...ctx, product: null };
  const { data } = await ctx.supabase.from("products").select("id").eq("id", id).eq("business_id", ctx.business.id).maybeSingle();
  return { ...ctx, product: data };
}

export async function addProductMedia(productId: string, path: string): Promise<Result> {
  const { supabase, business, product } = await ownedProduct(productId);
  if (!business || !product) return { error: "Produit introuvable." };
  const limited = await checkRateLimit(supabase, "upload");
  if (limited) return { error: limited };
  if (!ownsPath(path, business.id)) return { error: "Fichier non autorisé." };
  const { count } = await supabase.from("product_media").select("id", { count: "exact", head: true }).eq("product_id", productId);
  if ((count ?? 0) >= LIMITS.mediaMax) {
    await supabase.storage.from("uploads").remove([path]);
    return { error: `${LIMITS.mediaMax} photos maximum par produit.` };
  }
  const { error } = await supabase
    .from("product_media")
    .insert({ product_id: productId, business_id: business.id, file_path: path, sort_order: count ?? 0 });
  if (error) return { error: "Photo non enregistrée." };
  revalidatePath(`/catalogue/${productId}`);
  return { ok: true };
}

export async function deleteProductMedia(mediaId: string): Promise<Result> {
  const { supabase, business } = await getCurrentBusiness();
  if (!business) return { error: "Session expirée." };
  const { data } = await supabase.from("product_media").select("file_path, product_id").eq("id", mediaId).eq("business_id", business.id).maybeSingle();
  if (!data) return { error: "Photo introuvable." };
  await supabase.storage.from("uploads").remove([data.file_path]);
  await supabase.from("product_media").delete().eq("id", mediaId);
  revalidatePath(`/catalogue/${data.product_id}`);
  return { ok: true };
}

export async function setCoverMedia(mediaId: string): Promise<Result> {
  const { supabase, business } = await getCurrentBusiness();
  if (!business) return { error: "Session expirée." };
  const { data } = await supabase.from("product_media").select("product_id").eq("id", mediaId).eq("business_id", business.id).maybeSingle();
  if (!data) return { error: "Photo introuvable." };
  const { data: all } = await supabase.from("product_media").select("id").eq("product_id", data.product_id).order("sort_order");
  const ordered = [mediaId, ...(all ?? []).map((m) => m.id).filter((id) => id !== mediaId)];
  await Promise.all(ordered.map((id, i) => supabase.from("product_media").update({ sort_order: i }).eq("id", id)));
  revalidatePath(`/catalogue/${data.product_id}`);
  return { ok: true };
}

export async function deleteProduct(productId: string): Promise<Result> {
  const { supabase, product } = await ownedProduct(productId);
  if (!product) return { error: "Produit introuvable." };
  const { data: media } = await supabase.from("product_media").select("file_path").eq("product_id", productId);
  if (media?.length) await supabase.storage.from("uploads").remove(media.map((m) => m.file_path));
  const { error } = await supabase.from("products").delete().eq("id", productId);
  if (error) return { error: "Suppression impossible." };
  revalidatePath("/catalogue");
  redirect("/catalogue");
}

export async function duplicateProduct(productId: string): Promise<Result> {
  const { supabase, business, product } = await ownedProduct(productId);
  if (!business || !product) return { error: "Produit introuvable." };
  const limited = await checkRateLimit(supabase, "write");
  if (limited) return { error: limited };
  const { data: src } = await supabase.from("products").select("*").eq("id", productId).single();
  if (!src) return { error: "Produit introuvable." };
  const copy = { ...src } as Record<string, unknown>;
  for (const k of ["id", "created_at", "updated_at", "sku"]) delete copy[k];
  const { data, error } = await supabase
    .from("products")
    .insert({ ...copy, name: `${src.name} (copie)`.slice(0, 200), status: "draft" })
    .select("id")
    .single();
  if (error || !data) return { error: "Duplication impossible." };
  const { data: vars } = await supabase.from("product_variants").select("options, price_cents, stock_quantity, active, sort_order").eq("product_id", productId);
  if (vars?.length) await supabase.from("product_variants").insert(vars.map((v) => ({ ...v, product_id: data.id, business_id: business.id })));
  revalidatePath("/catalogue");
  redirect(`/catalogue/${data.id}`);
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------
export async function createCollection(name: string): Promise<Result & { id?: string }> {
  const n = name.trim();
  if (n.length < 1 || n.length > 120) return { error: "Nom de collection invalide (120 caractères maximum)." };
  const { supabase, business } = await getCurrentBusiness();
  if (!business) return { error: "Session expirée." };
  const limited = await checkRateLimit(supabase, "write");
  if (limited) return { error: limited };
  const { count } = await supabase.from("collections").select("id", { count: "exact", head: true }).eq("business_id", business.id);
  if ((count ?? 0) >= LIMITS.collectionsMax) return { error: `${LIMITS.collectionsMax} collections maximum.` };
  const { data: dup } = await supabase.from("collections").select("id").eq("business_id", business.id).ilike("name", n).maybeSingle();
  if (dup) return { ok: true, id: dup.id };
  const { data, error } = await supabase.from("collections").insert({ business_id: business.id, name: n, sort_order: count ?? 0 }).select("id").single();
  if (error || !data) return { error: "Collection non créée." };
  revalidatePath("/catalogue");
  return { ok: true, id: data.id };
}

export async function deleteCollection(id: string): Promise<Result> {
  const { supabase, business } = await getCurrentBusiness();
  if (!business) return { error: "Session expirée." };
  await supabase.from("collections").delete().eq("id", id).eq("business_id", business.id);
  revalidatePath("/catalogue");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Boutique : modèle par métier (la vitrine publique n'est pas encore en ligne)
// ---------------------------------------------------------------------------
const shopSchema = z.object({
  template: z.enum(SHOP_TEMPLATES.map((t) => t.id) as [string, ...string[]]),
  name: z.string().trim().max(80),
});

export async function saveShop(_: FormState, formData: FormData): Promise<FormState & { ok?: boolean }> {
  const parsed = shopSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Modèle de boutique invalide." };
  const { supabase, business } = await getCurrentBusiness();
  if (!business) return { error: "Renseignez d'abord votre commerce." };
  const limited = await checkRateLimit(supabase, "write");
  if (limited) return { error: limited };
  const { error } = await supabase
    .from("shops")
    .upsert({ business_id: business.id, template: parsed.data.template, name: parsed.data.name || null }, { onConflict: "business_id" });
  if (error) return { error: "Enregistrement impossible." };
  revalidatePath("/boutique");
  revalidatePath("/catalogue");
  return { ok: true };
}
