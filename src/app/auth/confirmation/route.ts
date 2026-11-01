import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Lien reçu par email (confirmation d'inscription, réinitialisation du mot de passe).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const suiteParam = searchParams.get("suite") ?? "/tableau-de-bord";
  const suite = suiteParam.startsWith("/") && !suiteParam.startsWith("//") ? suiteParam : "/tableau-de-bord";

  const supabase = await createClient();
  let ok = false;

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  if (ok) return NextResponse.redirect(`${origin}${suite}`);
  return NextResponse.redirect(`${origin}/connexion?erreur=lien`);
}
