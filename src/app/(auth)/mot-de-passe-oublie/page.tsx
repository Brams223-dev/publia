"use client";

import { useActionState } from "react";
import Link from "next/link";
import { forgotPassword } from "../actions";
import { Field, FormMessage, SubmitButton } from "../form-ui";

export default function ForgotPasswordPage() {
  const [state, action] = useActionState(forgotPassword, undefined);
  return (
    <>
      <h1 className="text-2xl font-semibold">Mot de passe oublié</h1>
      <p className="mt-1 mb-6 text-sm text-ink-soft">Recevez un lien pour choisir un nouveau mot de passe.</p>
      {state?.success ? (
        <FormMessage state={state} />
      ) : (
        <form action={action} className="space-y-4">
          <Field label="Email" name="email" type="email" autoComplete="email" required />
          <FormMessage state={state} />
          <SubmitButton>Envoyer le lien</SubmitButton>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link href="/connexion" className="font-semibold text-brand hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </>
  );
}
