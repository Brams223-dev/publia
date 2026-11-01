import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bot,
  CalendarDays,
  Clapperboard,
  CreditCard,
  FolderOpen,
  Gift,
  Globe,
  Home,
  Inbox,
  MapPin,
  Megaphone,
  Palette,
  Settings,
  Sparkles,
  SquarePlay,
  Star,
  Store,
  Users,
} from "lucide-react";

// `ready: false` → affiché comme « Bientôt », jamais comme un faux lien.
export type NavItem = { href: string; label: string; icon: LucideIcon; ready: boolean; mobile?: boolean };
export type NavGroup = { label: string | null; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      { href: "/tableau-de-bord", label: "Tableau de bord", icon: Home, ready: true, mobile: true },
      { href: "/fais-ma-communication", label: "Fais ma communication", icon: Sparkles, ready: true, mobile: true },
    ],
  },
  {
    label: "Assistant",
    items: [
      { href: "/campagnes", label: "Campagnes", icon: Megaphone, ready: true, mobile: true },
      { href: "/assistant", label: "Assistant marketing", icon: Bot, ready: false },
      { href: "/calendrier", label: "Calendrier", icon: CalendarDays, ready: false },
    ],
  },
  {
    label: "Studio",
    items: [
      { href: "/studio", label: "Studio créatif", icon: Palette, ready: false },
      { href: "/studio-video", label: "Studio vidéo", icon: Clapperboard, ready: false },
      { href: "/youtube", label: "YouTube Studio", icon: SquarePlay, ready: false },
      { href: "/bibliotheque", label: "Bibliothèque", icon: FolderOpen, ready: false },
    ],
  },
  {
    label: "Business",
    items: [
      { href: "/visibilite-locale", label: "Visibilité locale", icon: MapPin, ready: false },
      { href: "/avis", label: "Avis clients", icon: Star, ready: false },
      { href: "/contacts", label: "Contacts", icon: Users, ready: false },
      { href: "/fidelite", label: "Fidélité", icon: Gift, ready: false },
      { href: "/inbox", label: "Inbox", icon: Inbox, ready: false },
      { href: "/mini-site", label: "Mini-site", icon: Globe, ready: false },
    ],
  },
  {
    label: "Intelligence",
    items: [{ href: "/intelligence", label: "Performances", icon: BarChart3, ready: false }],
  },
  {
    label: "Compte",
    items: [
      { href: "/mon-commerce", label: "Mon commerce", icon: Store, ready: true, mobile: true },
      { href: "/abonnement", label: "Abonnement", icon: CreditCard, ready: false },
      { href: "/parametres", label: "Paramètres", icon: Settings, ready: false },
    ],
  },
];

export const NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
