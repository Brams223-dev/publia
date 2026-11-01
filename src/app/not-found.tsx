import Link from "next/link";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-md text-center">
        <Logo />
        <h1 className="mt-6 text-2xl font-semibold">Page introuvable</h1>
        <p className="mt-2 text-ink-soft">Cette page n&apos;existe pas ou a été déplacée.</p>
        <Link href="/" className="btn-primary mt-6">Retour à l&apos;accueil</Link>
      </div>
    </main>
  );
}
