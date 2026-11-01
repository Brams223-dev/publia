import Link from "next/link";
import { Camera, Clapperboard, FileImage, MessageSquareText, Sparkles, Wand2, SquarePlay } from "lucide-react";
import { Logo } from "@/components/logo";
import { PLANS } from "@/lib/config/plans";

const STEPS = [
  { icon: Camera, title: "Une photo", text: "Importez la photo de votre produit, de votre plat ou de votre réalisation." },
  { icon: MessageSquareText, title: "Une idée", text: "Décrivez en une phrase ce que vous voulez annoncer." },
  { icon: Wand2, title: "Votre contenu", text: "Publia rédige, met en page et prépare vos fichiers à publier." },
];

const FEATURES = [
  { icon: Sparkles, title: "Textes IA", text: "Titres, légendes, appels à l'action et hashtags adaptés à chaque réseau. Aucun prix ni horaire inventé." },
  { icon: FileImage, title: "Visuels professionnels", text: "Modèles graphiques à vos couleurs, avec votre logo, exportés en PNG haute résolution." },
  { icon: Clapperboard, title: "Vidéos IA", text: "Transformez une photo en vidéo promotionnelle verticale, carrée ou paysage, en MP4." },
  { icon: SquarePlay, title: "YouTube Studio", text: "Shorts 9:16, vidéos 16:9, titres optimisés, descriptions, mots-clés et miniatures 1280 × 720." },
];

const PLATFORMS = [
  { name: "Instagram", detail: "Carré, portrait, Stories, Reels" },
  { name: "TikTok", detail: "Vidéos verticales et scénarios" },
  { name: "Facebook", detail: "Publications et vidéos locales" },
  { name: "YouTube", detail: "Shorts, 16:9 et miniatures" },
];

const FAQ = [
  {
    q: "Faut-il savoir utiliser l'IA ou un logiciel de graphisme ?",
    a: "Non. Vous décrivez votre besoin avec vos mots, Publia s'occupe du texte, de la mise en page et du format.",
  },
  {
    q: "Publia publie-t-il directement sur mes réseaux ?",
    a: "Pas encore. Vous téléchargez vos visuels (PNG) et vidéos (MP4) et copiez les textes. La publication automatique arrivera après validation officielle des plateformes.",
  },
  {
    q: "L'IA peut-elle inventer des promotions ?",
    a: "Non. Publia n'ajoute jamais de prix, d'horaires ou d'offres que vous n'avez pas indiqués.",
  },
  {
    q: "Puis-je arrêter mon abonnement ?",
    a: "Oui, à tout moment depuis votre espace, sans engagement.",
  },
];

function PreviewCard() {
  return (
    <div className="card relative mx-auto w-full max-w-sm rotate-1 overflow-hidden p-4">
      <div className="flex aspect-[4/5] flex-col items-start rounded-2xl bg-gradient-to-br from-brand to-brand-light p-5 text-white">
        <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide">Nouveauté</span>
        <p className="mt-6 text-3xl font-bold leading-tight">Le burger maison du week-end</p>
        <p className="mt-2 text-sm text-white/85">Disponible samedi et dimanche</p>
        <span className="mt-auto rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand">Réservez votre table</span>
      </div>
      <p className="mt-3 text-sm text-ink-soft">#burgermaison #restaurantlocal #weekend</p>
      <span className="absolute top-6 right-6 rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-ink-soft shadow">
        Exemple de mise en page
      </span>
    </div>
  );
}

export default function Home() {
  return (
    <div>
      <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-2 text-sm">
            <a href="#tarifs" className="hidden px-3 py-2 text-ink-soft hover:text-ink sm:inline">Tarifs</a>
            <a href="#faq" className="hidden px-3 py-2 text-ink-soft hover:text-ink sm:inline">FAQ</a>
            <Link href="/connexion" className="whitespace-nowrap px-2 py-2 font-medium text-ink hover:text-brand sm:px-3">Connexion</Link>
            <Link href="/inscription" className="btn-primary whitespace-nowrap px-4 sm:px-5"><span className="sm:hidden">Essai gratuit</span><span className="hidden sm:inline">Essayer gratuitement</span></Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 md:grid-cols-2 md:py-24">
          <div>
            <p className="inline-flex rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
              Le studio marketing IA des commerces de proximité
            </p>
            <h1 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
              Une photo, une idée, et votre contenu est prêt.
            </h1>
            <p className="mt-5 max-w-lg text-lg text-ink-soft">
              Publia crée vos publications, visuels et vidéos pour Instagram, TikTok, Facebook et YouTube, en moins
              d&apos;une minute.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/inscription" className="btn-primary px-6 py-3 text-base">Essayer gratuitement</Link>
              <a href="#fonctionnalites" className="btn-ghost px-6 py-3 text-base">Voir les fonctionnalités</a>
            </div>
            <p className="mt-4 text-sm text-ink-soft">3 publications offertes · Sans carte bancaire</p>
          </div>
          <PreviewCard />
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <div key={title} className="card p-6">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-2xl bg-brand-soft text-brand">
                    <Icon className="size-5" />
                  </span>
                  <span className="text-sm font-semibold text-ink-soft">Étape {i + 1}</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-1 text-ink-soft">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="fonctionnalites" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight">Tout votre marketing au même endroit</h2>
          <p className="mt-2 max-w-2xl text-ink-soft">
            Coiffeurs, restaurants, fleuristes, garages, boutiques : chaque contenu s&apos;adapte à votre métier et à votre ton.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="card p-6">
                <span className="grid size-11 place-items-center rounded-2xl bg-brand text-white">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-1 text-ink-soft">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight">Quatre plateformes, les bons formats</h2>
          <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {PLATFORMS.map((p) => (
              <div key={p.name} className="card p-5">
                <p className="font-semibold">{p.name}</p>
                <p className="mt-1 text-sm text-ink-soft">{p.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="tarifs" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight">Des tarifs simples, sans engagement</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`card flex flex-col p-6 ${plan.id === "premium" ? "ring-2 ring-brand" : ""}`}
              >
                <p className="font-semibold">{plan.name}</p>
                <p className="mt-2 text-2xl font-bold">{plan.priceLabel}</p>
                <ul className="mt-5 flex-1 space-y-2 text-sm text-ink-soft">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" /> {f}
                    </li>
                  ))}
                </ul>
                <Link href="/inscription" className={`mt-6 ${plan.id === "premium" ? "btn-primary" : "btn-ghost"}`}>
                  Commencer
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-ink-soft">
            Pack vidéo supplémentaire : 3 crédits pour 9,90 €. La génération vidéo n&apos;est jamais illimitée.
          </p>
        </section>

        <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight">Questions fréquentes</h2>
          <div className="mt-6 space-y-3">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="card group p-5">
                <summary className="cursor-pointer list-none font-semibold marker:hidden">
                  {q}
                </summary>
                <p className="mt-2 text-ink-soft">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="rounded-[2rem] bg-brand px-6 py-12 text-center text-white sm:px-12">
            <h2 className="text-3xl font-bold tracking-tight">Votre commerce mérite d&apos;être visible.</h2>
            <p className="mx-auto mt-2 max-w-lg text-white/85">Créez votre premier contenu en moins d&apos;une minute.</p>
            <Link href="/inscription" className="btn mt-6 bg-white px-6 py-3 text-base text-brand hover:bg-brand-soft">
              Essayer gratuitement
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} Publia</p>
          <nav className="flex flex-wrap gap-4">
            <Link href="/mentions-legales" className="hover:text-ink">Mentions légales</Link>
            <Link href="/confidentialite" className="hover:text-ink">Confidentialité</Link>
            <Link href="/cgu" className="hover:text-ink">CGU</Link>
            <Link href="/cgv" className="hover:text-ink">CGV</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
