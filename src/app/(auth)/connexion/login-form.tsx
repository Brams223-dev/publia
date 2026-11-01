"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn } from "../actions";
import { Field, FormMessage, SubmitButton } from "../form-ui";

export function LoginForm({ suite, linkError }: { suite?: string; linkError?: boolean }) {
  const [state, action] = useActionState(
    signIn,
    linkError ? { error: "Ce lien est invalide ou a expiré. Connectez-vous ou demandez un nouveau lien." } : undefined,
  );
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="suite" value={suite ?? ""} />
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <Field label="Mot de passe" name="password" type="password" autoComplete="current-password" required />
      <div className="text-right">
        <Link href="/mot-de-passe-oublie" className="text-sm font-medium text-brand hover:underline">
          Mot de passe oublié ?
        </Link>
      </div>
      <FormMessage state={state} />
      <SubmitButton>Se connecter</SubmitButton>
    </form>
  );
}
