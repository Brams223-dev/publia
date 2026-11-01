"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { NAV, NAV_GROUPS } from "./nav";
import { Logo } from "@/components/logo";
import { signOut } from "../(auth)/actions";

const MOBILE_LABELS: Record<string, string> = {
  "/tableau-de-bord": "Accueil",
  "/fais-ma-communication": "Créer",
  "/campagnes": "Campagnes",
  "/calendrier": "Calendrier",
  "/mon-commerce": "Commerce",
};

export function Sidebar({ businessName }: { businessName: string | null }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {/* Ordinateur et tablette */}
      <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col border-r border-line bg-white md:flex">
        <div className="px-6 pt-6">
          <Logo href="/tableau-de-bord" />
          {businessName && <p className="mt-3 truncate text-sm text-ink-soft">{businessName}</p>}
        </div>
        <nav className="mt-4 flex-1 overflow-y-auto px-4 pb-4">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} className={group.label ? "mt-5" : ""}>
              {group.label && (
                <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-soft/80">{group.label}</p>
              )}
              <div className="flex flex-col gap-0.5">
                {group.items.map(({ href, label, icon: Icon, ready }) =>
                  ready ? (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                        isActive(href) ? "bg-brand-soft text-brand" : "text-ink hover:bg-canvas"
                      } ${href === "/fais-ma-communication" && !isActive(href) ? "text-brand" : ""}`}
                    >
                      <Icon className="size-4 shrink-0" /> {label}
                    </Link>
                  ) : (
                    <span
                      key={href}
                      aria-disabled
                      className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2 text-sm text-ink-soft/60"
                    >
                      <Icon className="size-4 shrink-0" /> <span className="truncate">{label}</span>
                      <span className="ml-auto shrink-0 rounded-full bg-canvas px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide">
                        Bientôt
                      </span>
                    </span>
                  ),
                )}
              </div>
            </div>
          ))}
        </nav>
        <form action={signOut} className="border-t border-line p-4">
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-ink-soft hover:bg-canvas hover:text-ink">
            <LogOut className="size-4" /> Se déconnecter
          </button>
        </form>
      </aside>

      {/* Mobile : barre du bas avec les rubriques disponibles */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {NAV.filter((n) => n.ready && n.mobile).map(({ href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
              isActive(href) ? "text-brand" : "text-ink-soft"
            }`}
          >
            <Icon className="size-5" /> {MOBILE_LABELS[href]}
          </Link>
        ))}
      </nav>

      {/* Mobile : barre du haut */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-white/90 px-4 py-3 backdrop-blur md:hidden">
        <Logo href="/tableau-de-bord" />
        <form action={signOut}>
          <button aria-label="Se déconnecter" className="rounded-full p-2 text-ink-soft hover:bg-canvas">
            <LogOut className="size-5" />
          </button>
        </form>
      </header>
    </>
  );
}
