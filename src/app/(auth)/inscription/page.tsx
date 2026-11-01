import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Créer un compte" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Essayez Publia gratuitement</h1>
      <p className="mt-1 mb-6 text-sm text-ink-soft">3 publications offertes, sans carte bancaire.</p>
      <SignupForm />
      <p className="mt-6 text-center text-sm text-ink-soft">
        Déjà inscrit ?{" "}
        <Link href="/connexion" className="font-semibold text-brand hover:underline">
          Se connecter
        </Link>
      </p>
    </>
  );
}
