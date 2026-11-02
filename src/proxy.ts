import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/env";

const PROTECTED = ["/tableau-de-bord", "/fais-ma-communication", "/campagnes", "/autopilot", "/calendrier", "/comptes-sociaux", "/studio", "/bibliotheque", "/ads", "/catalogue", "/boutique", "/mon-commerce", "/organisation", "/invitation", "/admin", "/abonnement", "/parametres"];
const AUTH_PAGES = ["/connexion", "/inscription"];

export async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.next({ request });
  try {
    return await withSession(request);
  } catch (error) {
    // Ne jamais bloquer tout le site si Supabase est injoignable ou mal configuré.
    console.error("[proxy] session Supabase indisponible :", error);
    return NextResponse.next({ request });
  }
}

async function withSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Rafraîchit la session ; ne rien exécuter entre createServerClient et getUser.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED.some((p) => path === p || path.startsWith(`${p}/`));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.searchParams.set("suite", path);
    return NextResponse.redirect(url);
  }

  if (user && AUTH_PAGES.includes(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/tableau-de-bord";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
