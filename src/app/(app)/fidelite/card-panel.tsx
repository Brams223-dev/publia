"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Copy, Gift, Loader2, Plus, RefreshCw, SlidersHorizontal, UserRound } from "lucide-react";
import { applyLoyalty, rotateCardLink } from "./actions";

type Props = {
  card: { id: string; balance: number; total_earned: number; rewards_redeemed: number; contact: { id: string } };
  contactName: string;
  program: { kind: string; cost: number; unit: string; reward: string; active: boolean };
  publicUrl: string;
  events: { id: number; kind: string; amount: number; note: string | null; when: string; spend: string | null }[];
};
const KIND: Record<string, string> = { earn: "Ajout", redeem: "Récompense utilisée", adjust: "Ajustement" };

export function CardPanel({ card, contactName, program, publicUrl, events }: Props) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [spend, setSpend] = useState("");
  const [adjust, setAdjust] = useState({ open: false, amount: "", note: "" });
  const [url, setUrl] = useState(publicUrl);
  const [copied, setCopied] = useState(false);
  const pct = program.cost ? Math.min(100, (card.balance / program.cost) * 100) : 0;
  const rewards = program.cost ? Math.floor(card.balance / program.cost) : 0;

  const run = (fn: () => Promise<{ error?: string }>, ok: string) =>
    start(async () => {
      setMessage(null);
      const r = await fn();
      setMessage(r.error ? { type: "error", text: r.error } : { type: "ok", text: ok });
      if (!r.error) {
        setSpend("");
        setAdjust({ open: false, amount: "", note: "" });
      }
    });

  return (
    <section className="card space-y-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{contactName}</h2>
          <p className="text-sm text-ink-soft">{card.total_earned} {program.unit} gagnés au total · {card.rewards_redeemed} récompense(s) utilisée(s)</p>
        </div>
        <Link href={`/contacts/${card.contact.id}`} className="btn-ghost px-3 py-1.5 text-xs"><UserRound className="size-3.5" /> Fiche contact</Link>
      </div>

      <div>
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-2xl font-semibold">{card.balance} <span className="text-base font-normal text-ink-soft">/ {program.cost} {program.unit}</span></span>
          {rewards > 0 ? <span className="rounded-full bg-success/10 px-2 py-0.5 font-medium text-success">{rewards} récompense(s) disponible(s)</span> : null}
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-canvas"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} /></div>
        <p className="mt-1 text-xs text-ink-soft">Récompense : {program.reward}</p>
      </div>

      {!program.active ? <p className="text-sm text-amber-800">Programme en pause : réactivez-le dans les réglages pour ajouter des {program.unit}.</p> : null}

      <div className="flex flex-wrap items-end gap-2">
        {program.kind === "stamps" ? (
          <button type="button" className="btn-primary" disabled={pending || !program.active} onClick={() => run(() => applyLoyalty(card.id, "earn", { amount: 1 }), "1 tampon ajouté.")}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Ajouter 1 tampon
          </button>
        ) : (
          <>
            <div>
              <label className="label" htmlFor="spend">Montant de l&apos;achat (€)</label>
              <input id="spend" inputMode="decimal" value={spend} onChange={(e) => setSpend(e.target.value)} className="input w-36" placeholder="24,90" />
            </div>
            <button type="button" className="btn-primary" disabled={pending || !program.active || !spend} onClick={() => run(() => applyLoyalty(card.id, "earn", { spend }), "Points ajoutés.")}>
              <Plus className="size-4" /> Ajouter les points
            </button>
          </>
        )}
        <button
          type="button"
          className="btn-ghost"
          disabled={pending || !program.active || card.balance < program.cost}
          onClick={() => { if (window.confirm(`Utiliser la récompense « ${program.reward} » pour ${contactName} ?`)) run(() => applyLoyalty(card.id, "redeem", {}), "Récompense utilisée."); }}
        >
          <Gift className="size-4" /> Utiliser la récompense
        </button>
        <button type="button" className="btn-ghost" onClick={() => setAdjust((a) => ({ ...a, open: !a.open }))}><SlidersHorizontal className="size-4" /> Ajuster</button>
      </div>

      {adjust.open ? (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-line p-3">
          <div>
            <label className="label" htmlFor="adj-amount">Correction (+ ou −)</label>
            <input id="adj-amount" type="number" value={adjust.amount} onChange={(e) => setAdjust({ ...adjust, amount: e.target.value })} className="input w-28" />
          </div>
          <div className="min-w-[12rem] flex-1">
            <label className="label" htmlFor="adj-note">Motif (obligatoire)</label>
            <input id="adj-note" value={adjust.note} maxLength={200} onChange={(e) => setAdjust({ ...adjust, note: e.target.value })} className="input" placeholder="Ex. : reprise de l'ancienne carte papier" />
          </div>
          <button type="button" className="btn-primary" disabled={pending || !adjust.amount} onClick={() => run(() => applyLoyalty(card.id, "adjust", { amount: Number(adjust.amount), note: adjust.note }), "Solde corrigé.")}>Valider</button>
        </div>
      ) : null}

      {message ? <p className={`text-sm ${message.type === "error" ? "text-danger" : "text-success"}`}>{message.text}</p> : null}

      <div className="space-y-2 rounded-xl bg-brand-soft p-3 text-sm">
        <p className="font-medium">Carte du client</p>
        <p className="text-xs text-ink-soft">Envoyez ce lien au client : il voit son solde et sa récompense, sans compte ni application.</p>
        <div className="flex flex-wrap gap-2">
          <input readOnly value={url} className="input min-w-0 flex-1 py-2 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} aria-label="Lien de la carte" />
          <button type="button" className="btn-ghost px-3" onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); }}><Copy className="size-4" /> {copied ? "Copié" : "Copier"}</button>
          <button
            type="button"
            className="btn-ghost px-3"
            title="Créer un nouveau lien (l'ancien ne fonctionnera plus)"
            onClick={() => {
              if (!window.confirm("Créer un nouveau lien ? L'ancien ne fonctionnera plus.")) return;
              start(async () => {
                const r = await rotateCardLink(card.id);
                if (r.code) { setUrl(url.replace(/[^/]+$/, r.code)); setCopied(false); }
                else setMessage({ type: "error", text: r.error ?? "Erreur." });
              });
            }}
          >
            <RefreshCw className="size-4" />
          </button>
        </div>
      </div>

      <div>
        <p className="mb-2 font-medium">Historique</p>
        {events.length ? (
          <ul className="divide-y divide-line text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>{KIND[e.kind] ?? e.kind}{e.spend ? ` · achat de ${e.spend}` : ""}{e.note ? ` · ${e.note}` : ""}</span>
                <span className="text-ink-soft"><span className={e.amount > 0 ? "text-success" : "text-ink"}>{e.amount > 0 ? `+${e.amount}` : e.amount}</span> · {e.when}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-ink-soft">Aucune opération.</p>}
      </div>
    </section>
  );
}
