"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { logClientError } from "./actions";

/** Écran d'erreur commun : message clair, référence à communiquer au support, bouton pour réessayer. */
export function ErrorView({ error, retry, homeHref = "/" }: { error: unknown; retry: () => void; homeHref?: string }) {
  const digest = error && typeof error === "object" && "digest" in error ? String((error as { digest?: unknown }).digest ?? "") : "";

  useEffect(() => {
    // Les erreurs serveur sont déjà journalisées côté serveur (référence = digest) ; on ne renvoie que celles du navigateur.
    if (digest) return;
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    logClientError({ message, route: window.location.pathname }).catch(() => {});
  }, [error, digest]);

  return (
    <div className="mx-auto my-10 max-w-lg card p-6 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-danger/10 text-danger"><AlertTriangle className="size-6" /></span>
      <h1 className="mt-4 text-xl font-semibold">Un problème est survenu</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Vos données n&apos;ont pas été perdues. Réessayez ; si le problème continue, contactez le support
        {digest ? " en indiquant la référence ci-dessous" : ""}.
      </p>
      {digest ? <p className="mt-3 font-mono text-xs text-ink-soft">Référence : {digest}</p> : null}
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={() => retry()} className="btn-primary"><RotateCcw className="size-4" /> Réessayer</button>
        <Link href={homeHref} className="btn-ghost">Retour à l&apos;accueil</Link>
      </div>
    </div>
  );
}
