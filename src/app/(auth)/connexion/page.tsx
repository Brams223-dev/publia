import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string; erreur?: string }>;
}) {
  const { suite, erreur } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-semibold">Bon retour sur Publia</h1>
      <p className="mt-1 mb-6 text-sm text-ink-soft">Connectez-vous pour créer votre contenu.</p>
      <LoginForm suite={suite} linkError={erreur === "lien"} />
      <p className="mt-6 text-center text-sm text-ink-soft">
        Pas encore de compte ?{" "}
        <Link href={suite ? `/inscription?suite=${encodeURIComponent(suite)}` : "/inscription"} className="font-semibold text-brand hover:underline">
          Essayer gratuitement
        </Link>
      </p>
    </>
  );
}
