export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { Sidebar } from "./sidebar";
import { ConfigNotice } from "@/components/config-notice";
import { getCurrentBusiness } from "@/lib/business";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let switcher: { currentId: string | null; businesses: { id: string; name: string; organization: string }[] } = { currentId: null, businesses: [] };

  if (isSupabaseConfigured()) {
    const { user, business, businesses } = await getCurrentBusiness();
    if (!user) redirect("/connexion");
    switcher = {
      currentId: business?.id ?? null,
      businesses: businesses.map((b) => ({ id: b.id, name: b.name, organization: b.organization_name })),
    };
  }

  return (
    <div className="md:flex">
      <Sidebar switcher={switcher} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-28 sm:px-8 sm:py-10">
        <ConfigNotice />
        {children}
      </main>
    </div>
  );
}
