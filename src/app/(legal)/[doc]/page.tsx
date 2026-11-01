import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Logo } from "@/components/logo";

// Les textes juridiques définitifs doivent être rédigés ou validés par un professionnel
// (éditeur, hébergeur Vercel, sous-traitants Supabase / OpenAI / Stripe, durées de conservation).
const DOCS: Record<string, { title: string; points: string[] }> = {
  "mentions-legales": {
    title: "Mentions légales",
    points: ["Éditeur du service : à compléter (raison sociale, SIREN, adresse, directeur de la publication).", "Hébergement : Vercel Inc. (application) et Supabase (base de données, région UE)."],
  },
  confidentialite: {
    title: "Politique de confidentialité",
    points: [
      "Données traitées : compte (nom, email), informations du commerce, fichiers importés et contenus générés.",
      "Sous-traitants : Supabase (stockage), OpenAI (génération de textes), fournisseur vidéo, Stripe (paiement).",
      "Vos droits RGPD : accès, rectification, export, suppression du compte. Contact : à compléter.",
    ],
  },
  cgu: {
    title: "Conditions générales d'utilisation",
    points: ["Document en cours de rédaction : règles d'usage du service, contenus interdits, responsabilité sur les contenus publiés."],
  },
  cgv: {
    title: "Conditions générales de vente",
    points: ["Document en cours de rédaction : offres, prix TTC, crédits vidéo, résiliation, droit de rétractation."],
  },
};

export function generateStaticParams() {
  return Object.keys(DOCS).map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc } = await params;
  return { title: DOCS[doc]?.title ?? "Document" };
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const content = DOCS[doc];
  if (!content) notFound();
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Logo />
      <div className="card mt-8 p-6 sm:p-8">
        <p className="mb-3 inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
          Brouillon — à valider avant le lancement commercial
        </p>
        <h1 className="text-2xl font-semibold">{content.title}</h1>
        <ul className="mt-4 space-y-2 text-ink-soft">
          {content.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
    </main>
  );
}
