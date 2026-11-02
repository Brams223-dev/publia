import type { LucideIcon } from "lucide-react";
import { messages } from "@/i18n";

const L = messages.nav;
import {
  BarChart3,
  Building2,
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
  Package,
  Receipt,
  ShoppingBag,
  Plane,
  Plug,
  Shirt,
  ScanLine,
  UserRound,
  Film,
  Tag,
  Megaphone,
  BadgeEuro,
  Palette,
  Settings,
  Sparkles,
  SquarePlay,
  Star,
  Store,
  Users,
} from "lucide-react";

// `ready: false` → affiché comme « Bientôt », jamais comme un faux lien.
// Libellés : src/i18n/messages (aucun texte d'interface en dur ici).
export type NavItem = { href: string; label: string; icon: LucideIcon; ready: boolean; mobile?: string };
export type NavGroup = { label: string | null; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      { href: "/tableau-de-bord", label: L.items.dashboard, icon: Home, ready: true, mobile: L.mobile.dashboard },
      { href: "/fais-ma-communication", label: L.items.doMyMarketing, icon: Sparkles, ready: true, mobile: L.mobile.doMyMarketing },
    ],
  },
  {
    label: L.groups.assistant,
    items: [
      { href: "/campagnes", label: L.items.campaigns, icon: Megaphone, ready: true, mobile: L.mobile.campaigns },
      { href: "/assistant", label: L.items.assistant, icon: Bot, ready: false },
    ],
  },
  {
    label: L.groups.autopilot,
    items: [
      { href: "/autopilot", label: L.items.autopilot, icon: Plane, ready: true },
      { href: "/calendrier", label: L.items.calendar, icon: CalendarDays, ready: true, mobile: L.mobile.calendar },
      { href: "/comptes-sociaux", label: L.items.socialAccounts, icon: Plug, ready: true },
    ],
  },
  {
    label: L.groups.studio,
    items: [
      { href: "/studio", label: L.items.studio, icon: Palette, ready: true },
      { href: "/studio-video", label: L.items.videoStudio, icon: Clapperboard, ready: false },
      { href: "/youtube", label: L.items.youtube, icon: SquarePlay, ready: false },
      { href: "/bibliotheque", label: L.items.library, icon: FolderOpen, ready: true },
    ],
  },
  {
    label: L.groups.ads,
    items: [{ href: "/ads", label: L.items.ads, icon: BadgeEuro, ready: true }],
  },
  {
    label: L.groups.commerce,
    items: [
      { href: "/catalogue", label: L.items.catalog, icon: Package, ready: true },
      { href: "/boutique", label: L.items.shop, icon: ShoppingBag, ready: true },
      { href: "/commandes", label: L.items.orders, icon: Receipt, ready: false },
    ],
  },
  {
    label: L.groups.fashion,
    items: [
      { href: "/fashion/photo-produit", label: L.items.fashionPhoto, icon: ScanLine, ready: false },
      { href: "/fashion/mannequin", label: L.items.fashionModel, icon: Shirt, ready: false },
      { href: "/fashion/avatar", label: L.items.fashionAvatar, icon: UserRound, ready: false },
      { href: "/fashion/motion", label: L.items.fashionMotion, icon: Film, ready: false },
      { href: "/fashion/vinted", label: L.items.fashionVinted, icon: Tag, ready: false },
    ],
  },
  {
    label: L.groups.business,
    items: [
      { href: "/visibilite-locale", label: L.items.localVisibility, icon: MapPin, ready: false },
      { href: "/avis", label: L.items.reviews, icon: Star, ready: false },
      { href: "/contacts", label: L.items.contacts, icon: Users, ready: true },
      { href: "/fidelite", label: L.items.loyalty, icon: Gift, ready: false },
      { href: "/inbox", label: L.items.inbox, icon: Inbox, ready: true },
      { href: "/mini-site", label: L.items.miniSite, icon: Globe, ready: true },
    ],
  },
  {
    label: L.groups.intelligence,
    items: [{ href: "/intelligence", label: L.items.performance, icon: BarChart3, ready: false }],
  },
  {
    label: L.groups.account,
    items: [
      { href: "/mon-commerce", label: L.items.business, icon: Store, ready: true, mobile: L.mobile.business },
      { href: "/organisation", label: L.items.organization, icon: Building2, ready: true },
      { href: "/abonnement", label: L.items.subscription, icon: CreditCard, ready: false },
      { href: "/parametres", label: L.items.settings, icon: Settings, ready: true },
    ],
  },
];

export const NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
