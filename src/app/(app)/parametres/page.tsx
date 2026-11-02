import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { getUser } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { formatInstant } from "@/lib/format";
import { EmailForm, PasswordForm, ProfileForm, SignOutEverywhere } from "./forms";

export const metadata: Metadata = { title: "Paramètres" };

export default async function SettingsPage() {
  if (!isSupabaseConfigured()) return null;
  const { supabase, user } = await getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();

  return (
    <div className="mt-4 space-y-6">
      <header className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand text-white"><Settings className="size-6" /></span>
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Paramètres</h1>
          <p className="mt-1 text-ink-soft">Votre compte personnel. Les réglages des commerces et de l&apos;équipe sont dans « Organisation et équipe ».</p>
        </div>
      </header>
      <ProfileForm fullName={profile?.full_name ?? ""} />
      <EmailForm email={user.email ?? ""} pending={user.new_email ?? null} />
      <PasswordForm />
      <SignOutEverywhere lastSignIn={user.last_sign_in_at ? formatInstant(user.last_sign_in_at, "full") : null} />
    </div>
  );
}
