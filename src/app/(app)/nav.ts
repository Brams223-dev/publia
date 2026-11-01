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
  Plane,
  Plug,
  Shirt,
  ScanLine,
  UserRound,
  Film,
  Tag,
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
    ],
  },
  {
    label: "Autopilot",
    items: [
      { href: "/autopilot", label: "Publia Autopilot", icon: Plane, ready: true },
      { href: "/calendrier", label: "Calendrier de publication", icon: CalendarDays, ready: true, mobile: true },
      { href: "/comptes-sociaux", label: "Comptes sociaux", icon: Plug, ready: true },
    ],
  },
  {
    label: "Studio",
    items: [
      { href: "/studio", label: "Studio créatif", icon: Palette, ready: true },
      { href: "/studio-video", label: "Studio vidéo", icon: Clapperboard, ready: false },
      { href: "/youtube", label: "YouTube Studio", icon: SquarePlay, ready: false },
      { href: "/bibliotheque", label: "Bibliothèque", icon: FolderOpen, ready: true },
    ],
  },
  {
    label: "Fashion",
    items: [
      { href: "/fashion/photo-produit", label: "Photo produit", icon: ScanLine, ready: false },
      { href: "/fashion/mannequin", label: "Mannequin virtuel", icon: Shirt, ready: false },
      { href: "/fashion/avatar", label: "Mon Avatar", icon: UserRound, ready: false },
      { href: "/fashion/motion", label: "Fashion Motion", icon: Film, ready: false },
      { href: "/fashion/vinted", label: "Vinted Studio", icon: Tag, ready: false },
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
