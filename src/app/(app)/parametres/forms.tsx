"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { KeyRound, Loader2, LogOut, Mail, UserRound } from "lucide-react";
import { changeEmail, changePassword, signOutEverywhere, updateProfile, type FormState } from "./actions";

function Submit({ children, ghost }: { children: React.ReactNode; ghost?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className={ghost ? "btn-ghost" : "btn-primary"} disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : null} {children}
    </button>
  );
}

function Feedback({ state }: { state: FormState }) {
  if (state?.error) return <p className="text-sm text-danger">{state.error}</p>;
  if (state?.success) return <p className="text-sm text-success">{state.success}</p>;
  return null;
}

function Card({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <section className="card max-w-2xl space-y-4 p-5">
      <h2 className="flex items-center gap-2 font-semibold"><Icon className="size-4 text-brand" /> {title}</h2>
      {children}
    </section>
  );
}

export function ProfileForm({ fullName }: { fullName: string }) {
  const [state, action] = useActionState(updateProfile, undefined);
  return (
    <Card title="Profil" icon={UserRound}>
      <form action={action} className="space-y-3">
        <div>
          <label className="label" htmlFor="fullName">Nom affiché à votre équipe</label>
          <input id="fullName" name="fullName" required minLength={2} maxLength={100} defaultValue={fullName} className="input" autoComplete="name" />
        </div>
        <Submit>Enregistrer</Submit>
        <Feedback state={state} />
      </form>
    </Card>
  );
}

export function EmailForm({ email, pending }: { email: string; pending: string | null }) {
  const [state, action] = useActionState(changeEmail, undefined);
  return (
    <Card title="Adresse e-mail" icon={Mail}>
      <p className="text-sm text-ink-soft">Adresse actuelle : <span className="font-medium text-ink">{email}</span></p>
      {pending ? <p className="text-sm text-amber-800">Changement en attente de confirmation vers {pending}.</p> : null}
      <form action={action} className="space-y-3">
        <div>
          <label className="label" htmlFor="email">Nouvelle adresse</label>
          <input id="email" name="email" type="email" required maxLength={254} className="input" autoComplete="email" />
        </div>
        <Submit>Changer d&apos;adresse</Submit>
        <Feedback state={state} />
      </form>
    </Card>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, undefined);
  return (
    <Card title="Mot de passe" icon={KeyRound}>
      <form action={action} className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="current">Mot de passe actuel</label>
          <input id="current" name="current" type="password" required className="input" autoComplete="current-password" />
        </div>
        <div>
          <label className="label" htmlFor="next">Nouveau mot de passe</label>
          <input id="next" name="next" type="password" required minLength={8} maxLength={72} className="input" autoComplete="new-password" />
        </div>
        <div>
          <label className="label" htmlFor="confirm">Confirmation</label>
          <input id="confirm" name="confirm" type="password" required minLength={8} maxLength={72} className="input" autoComplete="new-password" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Submit>Modifier le mot de passe</Submit>
          <Feedback state={state} />
        </div>
      </form>
    </Card>
  );
}

export function SignOutEverywhere({ lastSignIn }: { lastSignIn: string | null }) {
  return (
    <Card title="Sessions" icon={LogOut}>
      {lastSignIn ? <p className="text-sm text-ink-soft">Dernière connexion : {lastSignIn}</p> : null}
      <p className="text-sm text-ink-soft">En cas de doute (appareil perdu, mot de passe partagé), déconnectez votre compte de tous les appareils.</p>
      <form action={signOutEverywhere}>
        <Submit ghost>Se déconnecter de tous les appareils</Submit>
      </form>
    </Card>
  );
}
