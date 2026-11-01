"use client";

import { useActionState } from "react";
import { resetPassword } from "../actions";
import { Field, FormMessage, SubmitButton } from "../form-ui";

export default function ResetPasswordPage() {
  const [state, action] = useActionState(resetPassword, undefined);
  return (
    <>
      <h1 className="text-2xl font-semibold">Nouveau mot de passe</h1>
      <p className="mt-1 mb-6 text-sm text-ink-soft">Choisissez un mot de passe d&apos;au moins 8 caractères.</p>
      <form action={action} className="space-y-4">
        <Field label="Nouveau mot de passe" name="password" type="password" autoComplete="new-password" minLength={8} required />
        <Field label="Confirmez le mot de passe" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
        <FormMessage state={state} />
        <SubmitButton>Enregistrer</SubmitButton>
      </form>
    </>
  );
}
