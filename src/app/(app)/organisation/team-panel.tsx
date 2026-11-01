"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Copy, Loader2, Mail, UserPlus, Users, X } from "lucide-react";
import type { OrgRole } from "@/lib/business";
import { changeRole, inviteMember, removeMember, revokeInvitation, type InviteState } from "./actions";

const ROLE_LABELS: Record<OrgRole, string> = { owner: "Propriétaire", admin: "Administrateur", member: "Employé" };
const ROLE_HINTS: Record<"admin" | "member", string> = {
  admin: "Gère les commerces, leurs réglages et invite des employés.",
  member: "Crée et modifie les contenus, le catalogue et les publicités. Ne modifie pas les réglages.",
};

export type Member = { user_id: string; email: string; full_name: string; role: OrgRole; joined_at: string; joined?: string };
export type Invitation = { id: string; email: string; role: "admin" | "member"; expires: string };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary" disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />} Créer l&apos;invitation
    </button>
  );
}

export function TeamPanel({
  meId,
  myRole,
  members,
  invitations,
  seats,
  maxSeats,
}: {
  meId: string;
  myRole: OrgRole;
  members: Member[];
  invitations: Invitation[];
  seats: number;
  maxSeats: number;
}) {
  const [state, action] = useActionState<InviteState, FormData>(inviteMember, undefined);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const manage = myRole === "owner" || myRole === "admin";

  const run = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r?.error) setError(r.error);
    });

  return (
    <section className="card space-y-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold"><Users className="size-4 text-brand" /> Équipe</h2>
        <span className="text-sm text-ink-soft">{seats} / {maxSeats} places (invitations comprises)</span>
      </div>

      <ul className="divide-y divide-line">
        {members.map((m) => {
          const isMe = m.user_id === meId;
          const canRemove = !isMe && (myRole === "owner" ? m.role !== "owner" : myRole === "admin" && m.role === "member");
          return (
            <li key={m.user_id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
                {(m.full_name || m.email).charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{m.full_name || m.email}{isMe ? " (vous)" : ""}</span>
                <span className="block truncate text-xs text-ink-soft">{m.email} · membre depuis le {m.joined}</span>
              </span>
              {myRole === "owner" && m.role !== "owner" ? (
                <select
                  aria-label={`Rôle de ${m.email}`}
                  className="input w-auto py-1.5"
                  value={m.role}
                  disabled={pending}
                  onChange={(e) => run(() => changeRole(m.user_id, e.target.value as "admin" | "member"))}
                >
                  <option value="admin">Administrateur</option>
                  <option value="member">Employé</option>
                </select>
              ) : (
                <span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-medium">{ROLE_LABELS[m.role]}</span>
              )}
              {canRemove ? (
                <button
                  type="button"
                  className="btn-ghost px-3 py-1.5 text-xs text-danger hover:border-danger hover:text-danger"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm(`Retirer ${m.email} de l'organisation ? Son accès sera coupé immédiatement.`)) run(() => removeMember(m.user_id));
                  }}
                >
                  Retirer
                </button>
              ) : null}
              {isMe && m.role !== "owner" ? (
                <button
                  type="button"
                  className="btn-ghost px-3 py-1.5 text-xs"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm("Quitter cette organisation ? Vous perdrez l'accès à ses commerces.")) run(() => removeMember(m.user_id));
                  }}
                >
                  Quitter
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>

      {manage && invitations.length ? (
        <div>
          <p className="text-sm font-semibold">Invitations en attente</p>
          <ul className="mt-2 space-y-2">
            {invitations.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm">
                <Mail className="size-4 text-ink-soft" />
                <span className="min-w-0 flex-1 truncate">{i.email} · {ROLE_LABELS[i.role]} · expire le {i.expires}</span>
                <button type="button" aria-label={`Annuler l'invitation de ${i.email}`} className="rounded-full p-1 text-ink-soft hover:text-danger" disabled={pending} onClick={() => run(() => revokeInvitation(i.id))}>
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {manage ? (
        <form action={action} className="space-y-3 border-t border-line pt-5">
          <p className="font-semibold">Inviter une personne</p>
          <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
            <div>
              <label className="label" htmlFor="invite-email">Adresse e-mail</label>
              <input id="invite-email" name="email" type="email" required maxLength={254} className="input" placeholder="prenom@exemple.fr" />
            </div>
            <div>
              <label className="label" htmlFor="invite-role">Rôle</label>
              <select id="invite-role" name="role" defaultValue="member" className="input">
                <option value="member">Employé</option>
                {myRole === "owner" ? <option value="admin">Administrateur</option> : null}
              </select>
            </div>
          </div>
          <ul className="space-y-0.5 text-xs text-ink-soft">
            <li><span className="font-medium text-ink">Employé : </span>{ROLE_HINTS.member}</li>
            <li><span className="font-medium text-ink">Administrateur : </span>{ROLE_HINTS.admin}</li>
          </ul>
          <Submit />
          {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
          {state?.link ? (
            <div className="space-y-2 rounded-xl bg-brand-soft p-3 text-sm">
              <p>
                Invitation créée pour <span className="font-medium">{state.email}</span>. Envoyez-lui ce lien (valable 7 jours, utilisable
                une seule fois, uniquement avec cette adresse e-mail). L&apos;envoi automatique par e-mail arrivera avec les notifications.
              </p>
              <div className="flex gap-2">
                <input readOnly value={state.link} className="input py-2 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} aria-label="Lien d'invitation" />
                <button
                  type="button"
                  className="btn-ghost px-3"
                  onClick={async () => {
                    await navigator.clipboard.writeText(state.link!);
                    setCopied(true);
                  }}
                >
                  <Copy className="size-4" /> {copied ? "Copié" : "Copier"}
                </button>
              </div>
            </div>
          ) : null}
        </form>
      ) : (
        <p className="border-t border-line pt-4 text-sm text-ink-soft">Seuls le propriétaire et les administrateurs peuvent inviter des membres.</p>
      )}

      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </section>
  );
}
