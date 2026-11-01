"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp } from "../actions";
import { Field, FormMessage, SubmitButton } from "../form-ui";

export function SignupForm({ suite }: { suite?: string }) {
  const [state, action] = useActionState(signUp, undefined);
  if (state?.success) return <FormMessage state={state} />;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="suite" value={suite ?? ""} />
      <Field label="Votre nom" name="fullName" autoComplete="name" required />
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <Field
        label="Mot de passe (8 caractères minimum)"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
      />
      <label className="flex items-start gap-3 text-sm text-ink-soft">
        <input type="checkbox" name="terms" className="mt-0.5 size-4 accent-brand" required />
        <span>
          J&apos;accepte les{" "}
          <Link href="/cgu" className="text-brand hover:underline">
            conditions d&apos;utilisation
          </Link>{" "}
          et la{" "}
          <Link href="/confidentialite" className="text-brand hover:underline">
            politique de confidentialité
          </Link>
          .
        </span>
      </label>
      <FormMessage state={state} />
      <SubmitButton>Créer mon compte</SubmitButton>
    </form>
  );
}
