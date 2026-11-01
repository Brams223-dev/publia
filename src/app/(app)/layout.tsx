export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { Sidebar } from "./sidebar";
import { ConfigNotice } from "@/components/config-notice";
import { getUser } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let businessName: string | null = null;

  if (isSupabaseConfigured()) {
    const { supabase, user } = await getUser();
    if (!user) redirect("/connexion");
    const { data } = await supabase
      .from("businesses")
      .select("name")
      .eq("owner_id", user.id)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    businessName = data?.name ?? null;
  }

  return (
    <div className="md:flex">
      <Sidebar businessName={businessName} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-28 sm:px-8 sm:py-10">
        <ConfigNotice />
        {children}
      </main>
    </div>
  );
}
