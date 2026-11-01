import type { Metadata } from "next";
import { Plug, ShieldCheck } from "lucide-react";

export const metadata: Metadata = { title: "Comptes sociaux" };

// État réel des connexions. Aucune connexion n'est simulée : chaque réseau s'activera
// après création et validation de l'application auprès de la plateforme concernée.
const NETWORKS = [
  {
    name: "Instagram",
    api: "Instagram Graph API (Meta)",
    needs: "Compte Instagram professionnel relié à une page Facebook, application Meta validée (App Review) pour la publication.",
  },
  {
    name: "Facebook",
    api: "Graph API — Pages (Meta)",
    needs: "Page Facebook et application Meta validée pour publier au nom de la page.",
  },
  {
    name: "TikTok",
    api: "TikTok Content Posting API",
    needs: "Application TikTok for Developers ; un audit TikTok est requis avant toute publication publique.",
  },
  {
    name: "YouTube",
    api: "YouTube Data API v3 (Google)",
    needs: "Projet Google Cloud et écran de consentement OAuth ; sans audit Google, les vidéos sont envoyées en privé uniquement.",
  },
];

export default function SocialAccountsPage() {
  return (
    <div className="mt-4 space-y-6">
      <header className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
          <Plug className="size-6" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Comptes sociaux</h1>
          <p className="mt-1 text-ink-soft">Connexion de vos réseaux pour la publication automatique.</p>
        </div>
      </header>

      <p className="flex gap-2 rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink-soft">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" />
        Publia n&apos;utilise que les API officielles des plateformes. Vos identifiants ne sont jamais demandés : la
        connexion passe par la page de chaque réseau, et les jetons d&apos;accès sont chiffrés côté serveur.
      </p>

      <ul className="grid gap-3 md:grid-cols-2">
        {NETWORKS.map((n) => (
          <li key={n.name} className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">{n.name}</p>
              <span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold text-ink-soft">Non connecté</span>
            </div>
            <p className="mt-1 text-xs text-ink-soft">{n.api}</p>
            <p className="mt-3 text-sm text-ink-soft">{n.needs}</p>
            <button type="button" disabled className="btn-ghost mt-4 w-full">Connexion bientôt disponible</button>
          </li>
        ))}
      </ul>

      <p className="text-sm text-ink-soft">
        En attendant, l&apos;Autopilot programme vos contenus et vous indique le moment de les publier, avec copie en un clic.
      </p>
    </div>
  );
}
