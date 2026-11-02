import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Coins } from "lucide-react";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { formatDay, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Coûts fournisseurs" };

const CATEGORY: Record<string, string> = {
  ai: "Consommation IA",
  payment_fees: "Frais de paiement",
  ad_spend: "Budget publicitaire",
  shipping: "Livraison",
  domain: "Noms de domaine",
  other: "Autres frais externes",
};
const OPERATION: Record<string, string> = {
  generate_campaign: "Fais ma communication",
  generate_product: "Fiche produit IA",
  generate_ads: "Créations publicitaires",
  generate_post: "Publication",
};

type Row = {
  month: string; category: string; provider: string; model: string | null; operation: string;
  calls: number; errors: number; input_tokens: number; output_tokens: number; images: number;
  amount_cents: number | null; computed_cost: number | null; unpriced_calls: number; price_currency: string | null;
};

/** Page interne : réservée aux administrateurs de la plateforme (table app_admins). */
export default async function CostsPage() {
  const { supabase, user } = await getUser();
  if (!user || !isAdminConfigured()) notFound();
  const { data: isAdmin } = await supabase.rpc("is_app_admin");
  if (!isAdmin) notFound();

  const admin = createAdminClient();
  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - 2, 1);
  const [{ data }, { data: top }] = await Promise.all([
    admin.from("provider_usage_monthly").select("*").gte("month", since.toISOString().slice(0, 10)).order("month", { ascending: false }),
    admin
      .from("provider_usage")
      .select("organization_id, input_tokens, output_tokens, organizations(name)")
      .gte("created_at", new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString())
      .not("organization_id", "is", null)
      .limit(5000),
  ]);
  const rows = (data ?? []) as Row[];
  const months = Array.from(new Set(rows.map((r) => r.month)));
  const byOrg = new Map<string, { name: string; tokens: number; calls: number }>();
  for (const u of top ?? []) {
    const k = u.organization_id as string;
    const cur = byOrg.get(k) ?? { name: (u.organizations as unknown as { name: string } | null)?.name ?? k, tokens: 0, calls: 0 };
    cur.tokens += u.input_tokens + u.output_tokens;
    cur.calls += 1;
    byOrg.set(k, cur);
  }
  const topOrgs = [...byOrg.values()].sort((a, b) => b.tokens - a.tokens).slice(0, 10);
  const unpriced = rows.reduce((s, r) => s + Number(r.unpriced_calls ?? 0), 0);

  return (
    <div className="mt-4 space-y-6">
      <header className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand text-white"><Coins className="size-6" /></span>
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Coûts fournisseurs</h1>
          <p className="mt-1 text-ink-soft">Consommation réelle mesurée à chaque appel, séparée de l&apos;abonnement Publia. Page interne.</p>
        </div>
      </header>

      {unpriced > 0 ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {formatNumber(unpriced)} appel(s) n&apos;ont pas de coût calculé : le tarif du modèle n&apos;est pas encore saisi. Ajoutez-le dans
          Supabase, table <code>provider_prices</code> (prix par unité en millionièmes, avec la page source du fournisseur). Aucun prix
          n&apos;est supposé.
        </p>
      ) : null}

      {months.length === 0 ? (
        <div className="card p-8 text-center text-sm text-ink-soft">Aucune consommation enregistrée pour le moment.</div>
      ) : (
        months.map((m) => {
          const list = rows.filter((r) => r.month === m);
          return (
            <section key={m} className="card space-y-3 p-5">
              <h2 className="font-semibold capitalize">{formatDay(m, "month")}</h2>
              <div className="-mx-5 overflow-x-auto px-5">
                <table className="w-full min-w-[44rem] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-ink-soft">
                      <th className="py-2 pr-3 font-medium">Catégorie</th>
                      <th className="py-2 pr-3 font-medium">Fournisseur / modèle</th>
                      <th className="py-2 pr-3 font-medium">Opération</th>
                      <th className="py-2 pr-3 text-right font-medium">Appels</th>
                      <th className="py-2 pr-3 text-right font-medium">Jetons entrée</th>
                      <th className="py-2 pr-3 text-right font-medium">Jetons sortie</th>
                      <th className="py-2 text-right font-medium">Coût</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((r) => (
                      <tr key={`${r.category}-${r.provider}-${r.model}-${r.operation}`} className="border-t border-line">
                        <td className="py-2 pr-3">{CATEGORY[r.category] ?? r.category}</td>
                        <td className="py-2 pr-3">{r.provider}{r.model ? ` · ${r.model}` : ""}</td>
                        <td className="py-2 pr-3">{OPERATION[r.operation] ?? r.operation}</td>
                        <td className="py-2 pr-3 text-right">{formatNumber(r.calls)}{r.errors ? <span className="text-danger"> ({r.errors} échec)</span> : null}</td>
                        <td className="py-2 pr-3 text-right">{formatNumber(r.input_tokens)}</td>
                        <td className="py-2 pr-3 text-right">{formatNumber(r.output_tokens)}</td>
                        <td className="py-2 text-right">
                          {r.computed_cost != null && Number(r.unpriced_calls) === 0
                            ? `${Number(r.computed_cost).toFixed(4)} ${r.price_currency ?? ""}`
                            : r.amount_cents != null
                              ? `${(r.amount_cents / 100).toFixed(2)}`
                              : <span className="text-ink-soft">tarif manquant</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      )}

      {topOrgs.length ? (
        <section className="card space-y-3 p-5">
          <h2 className="font-semibold">Organisations les plus consommatrices ce mois-ci</h2>
          <ul className="divide-y divide-line text-sm">
            {topOrgs.map((o) => (
              <li key={o.name} className="flex justify-between gap-3 py-2">
                <span className="truncate">{o.name}</span>
                <span className="shrink-0 text-ink-soft">{formatNumber(o.calls)} appels · {formatNumber(o.tokens)} jetons</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
