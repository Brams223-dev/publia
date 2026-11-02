import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Gift } from "lucide-react";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { DEFAULT_COLORS } from "@/lib/config/business";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ma carte de fidélité", robots: { index: false, follow: false } };

/** Carte consultable par le client via son lien personnel (aucune donnée personnelle hormis le prénom). */
export default async function PublicCardPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^[a-f0-9]{16,64}$/.test(code) || !isAdminConfigured()) notFound();
  const admin = createAdminClient();
  const { data: card } = await admin.from("loyalty_cards").select("business_id, balance, rewards_redeemed, contacts(first_name)").eq("public_code", code).maybeSingle();
  if (!card) notFound();
  const [{ data: program }, { data: b }] = await Promise.all([
    admin.from("loyalty_programs").select("kind, stamps_required, reward_threshold, reward_label, terms, active").eq("business_id", card.business_id).maybeSingle(),
    admin.from("businesses").select("name, brand_colors, logo_url").eq("id", card.business_id).maybeSingle(),
  ]);
  if (!program || !b) notFound();
  const colors = { ...DEFAULT_COLORS, ...(b.brand_colors ?? {}) };
  const logo = b.logo_url ? (await admin.storage.from("brand-assets").createSignedUrl(b.logo_url, 3600)).data?.signedUrl : null;
  const cost = program.kind === "stamps" ? program.stamps_required : program.reward_threshold;
  const firstName = (card.contacts as unknown as { first_name: string | null } | null)?.first_name;
  const ready = card.balance >= cost;

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-[var(--shadow-card)]">
        <div className="space-y-2 p-6 text-white" style={{ background: colors.primary }}>
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logo ? <img src={logo} alt="" className="size-12 rounded-xl bg-white object-contain p-1" /> : <Gift className="size-8" />}
            <div>
              <p className="text-sm text-white/80">Carte de fidélité</p>
              <p className="text-lg font-semibold">{b.name}</p>
            </div>
          </div>
          {firstName ? <p className="pt-2 text-white/90">Bonjour {firstName} !</p> : null}
        </div>
        <div className="space-y-4 p-6">
          {program.kind === "stamps" ? (
            <div className="grid grid-cols-5 gap-2" aria-label={`${Math.min(card.balance, cost)} tampons sur ${cost}`}>
              {Array.from({ length: cost }, (_, i) => (
                <span key={i} className="grid aspect-square place-items-center rounded-full border-2 text-sm font-semibold" style={i < card.balance ? { background: colors.primary, borderColor: colors.primary, color: "#fff" } : { borderColor: "#E6E3F2", color: "#C4C1D6" }}>
                  {i < card.balance ? "✓" : i + 1}
                </span>
              ))}
            </div>
          ) : (
            <div>
              <p className="text-3xl font-semibold">{card.balance} <span className="text-base font-normal text-ink-soft">/ {cost} points</span></p>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-canvas"><div className="h-full rounded-full" style={{ width: `${Math.min(100, (card.balance / cost) * 100)}%`, background: colors.primary }} /></div>
            </div>
          )}
          <p className={`rounded-xl p-3 text-sm ${ready ? "bg-success/10 font-medium text-success" : "bg-canvas"}`}>
            {ready ? `Bravo ! Votre récompense vous attend : ${program.reward_label}.` : `Plus que ${cost - card.balance} ${program.kind === "stamps" ? "tampon(s)" : "point(s)"} pour : ${program.reward_label}.`}
          </p>
          {!program.active ? <p className="text-xs text-ink-soft">Le programme est momentanément suspendu.</p> : null}
          {program.terms ? <p className="text-xs text-ink-soft">{program.terms}</p> : null}
          {card.rewards_redeemed ? <p className="text-xs text-ink-soft">{card.rewards_redeemed} récompense(s) déjà obtenue(s). Merci de votre fidélité !</p> : null}
        </div>
      </div>
    </main>
  );
}
