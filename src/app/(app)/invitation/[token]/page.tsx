import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UserPlus } from "lucide-react";
import { getUser } from "@/lib/supabase/server";
import { previewInvitation } from "../../organisation/actions";
import { AcceptButton } from "./accept-button";

export const metadata: Metadata = { title: "Invitation" };

const ROLE = { admin: "administrateur", member: "employé" } as const;

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) notFound();
  const { user } = await getUser();
  if (!user) return null;
  const inv = await previewInvitation(token);

  const card = (title: string, body: React.ReactNode, action?: React.ReactNode) => (
    <div className="mx-auto mt-8 max-w-lg card p-6 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand"><UserPlus className="size-6" /></span>
      <h1 className="mt-4 text-xl font-semibold">{title}</h1>
      <div className="mt-2 text-sm text-ink-soft">{body}</div>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );

  if (!inv) return card("Invitation introuvable", "Ce lien n'est pas valide. Demandez une nouvelle invitation.", <Link href="/tableau-de-bord" className="btn-ghost">Retour</Link>);
  if (inv.status === "used") return card("Invitation déjà utilisée", "Ce lien a déjà servi.", <Link href="/tableau-de-bord" className="btn-ghost">Retour</Link>);
  if (inv.status === "expired") return card("Invitation expirée", "Les invitations sont valables 7 jours. Demandez-en une nouvelle.", <Link href="/tableau-de-bord" className="btn-ghost">Retour</Link>);
  if (!inv.email_matches)
    return card(
      "Autre adresse e-mail attendue",
      <>Cette invitation a été envoyée à <span className="font-medium text-ink">{inv.email_hint}</span>. Déconnectez-vous puis connectez-vous (ou créez un compte) avec cette adresse.</>,
    );

  return card(
    `Rejoindre ${inv.organization}`,
    <>Vous êtes invité à rejoindre l&apos;organisation <span className="font-medium text-ink">{inv.organization}</span> en tant que {ROLE[inv.role]}.</>,
    <AcceptButton token={token} />,
  );
}
