"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { NAV } from "./nav";
import { Logo } from "@/components/logo";
import { signOut } from "../(auth)/actions";

export function Sidebar({ businessName }: { businessName: string | null }) {
  const pathname = usePathname();
  return (
    <>
      {/* Ordinateur et tablette */}
      <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col border-r border-line bg-white px-4 py-6 md:flex">
        <Logo href="/tableau-de-bord" className="px-2" />
        {businessName && <p className="mt-4 truncate px-2 text-sm text-ink-soft">{businessName}</p>}
        <nav className="mt-6 flex flex-1 flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon, ready, phase }) =>
            ready ? (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  pathname === href ? "bg-brand-soft text-brand" : "text-ink hover:bg-canvas"
                }`}
              >
                <Icon className="size-4" /> {label}
              </Link>
            ) : (
              <span
                key={href}
                aria-disabled
                title={`Disponible à la phase ${phase}`}
                className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink-soft/70"
              >
                <Icon className="size-4 shrink-0" /> <span className="whitespace-nowrap">{label}</span>
                <span className="ml-auto rounded-full bg-canvas px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                  Bientôt
                </span>
              </span>
            ),
          )}
        </nav>
        <form action={signOut}>
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink-soft hover:bg-canvas hover:text-ink">
            <LogOut className="size-4" /> Se déconnecter
          </button>
        </form>
      </aside>

      {/* Mobile : barre du bas avec les rubriques disponibles */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {NAV.filter((n) => n.ready).map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
              pathname === href ? "text-brand" : "text-ink-soft"
            }`}
          >
            <Icon className="size-5" /> {label}
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
