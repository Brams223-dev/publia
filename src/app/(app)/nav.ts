import type { LucideIcon } from "lucide-react";
import { Clapperboard, CreditCard, FolderOpen, Home, PenSquare, Settings, Store, SquarePlay } from "lucide-react";

// `ready: false` → affiché comme « Bientôt », jamais comme un faux lien.
export type NavItem = { href: string; label: string; icon: LucideIcon; ready: boolean; phase?: number };

export const NAV: NavItem[] = [
  { href: "/tableau-de-bord", label: "Tableau de bord", icon: Home, ready: true },
  { href: "/mon-commerce", label: "Mon commerce", icon: Store, ready: true },
  { href: "/creer/publication", label: "Publication", icon: PenSquare, ready: false, phase: 3 },
  { href: "/creer/video", label: "Vidéo IA", icon: Clapperboard, ready: false, phase: 5 },
  { href: "/youtube", label: "YouTube Studio", icon: SquarePlay, ready: false, phase: 6 },
  { href: "/creations", label: "Mes créations", icon: FolderOpen, ready: false, phase: 3 },
  { href: "/abonnement", label: "Abonnement", icon: CreditCard, ready: false, phase: 7 },
  { href: "/parametres", label: "Paramètres", icon: Settings, ready: false, phase: 8 },
];
