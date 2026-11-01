// Moteur de composition déterministe (Canvas 2D) : modèles + photo + textes + logo + couleurs.
// Aucun contenu n'est généré par IA ici : les textes restent nets et exactement ceux saisis.

import type { TemplateCategory } from "./formats";

export const FONT = '"Inter Variable", Inter, "Helvetica Neue", Arial, sans-serif';

export type Img = CanvasImageSource & { width: number; height: number };
export type LogoPosition = "tl" | "tr" | "bl" | "br" | "none";

export type RenderParams = {
  title: string;
  subtitle: string;
  badge: string;
  cta: string;
  colors: { primary: string; secondary: string; text: string };
  photo: { img: Img | null; zoom: number; x: number; y: number };
  logo: { img: Img | null; position: LogoPosition };
};

type Ctx = CanvasRenderingContext2D;
type Box = { x: number; y: number; w: number; h: number };

export type Template = {
  id: string;
  name: string;
  category: TemplateCategory;
  usesPhoto: boolean;
  /** Position du logo par défaut, choisie pour ne pas recouvrir les textes. */
  logo: LogoPosition;
  draw: (ctx: Ctx, W: number, H: number, p: RenderParams) => void;
};

// ---------------------------------------------------------------------------
// Couleurs
// ---------------------------------------------------------------------------
function rgb(hex: string) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function luminance(hex: string) {
  const { r, g, b } = rgb(hex);
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
/** Couleur de texte lisible sur un fond donné. */
export function onColor(bg: string, dark = "#1d1c2b") {
  return luminance(bg) > 0.42 ? dark : "#ffffff";
}
export function mix(a: string, b: string, t: number) {
  const x = rgb(a);
  const y = rgb(b);
  const c = (k: "r" | "g" | "b") => Math.round(x[k] + (y[k] - x[k]) * t);
  return `rgb(${c("r")}, ${c("g")}, ${c("b")})`;
}
const alpha = (hex: string, a: number) => {
  const { r, g, b } = rgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

// ---------------------------------------------------------------------------
// Formes et images
// ---------------------------------------------------------------------------
function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Photo en mode « couvrir », avec zoom (1–3) et cadrage x/y (-1…1). */
function drawPhoto(ctx: Ctx, p: RenderParams, b: Box, radius = 0, shape: "rect" | "circle" = "rect") {
  ctx.save();
  if (shape === "circle") {
    ctx.beginPath();
    ctx.arc(b.x + b.w / 2, b.y + b.h / 2, Math.min(b.w, b.h) / 2, 0, Math.PI * 2);
  } else roundRect(ctx, b.x, b.y, b.w, b.h, radius);
  ctx.clip();

  const img = p.photo.img;
  if (!img || !img.width) {
    const g = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
    g.addColorStop(0, mix(p.colors.secondary, "#ffffff", 0.35));
    g.addColorStop(1, mix(p.colors.primary, "#ffffff", 0.2));
    ctx.fillStyle = g;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = `600 ${Math.max(14, Math.min(b.w, b.h) * 0.06)}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Votre photo", b.x + b.w / 2, b.y + b.h * (b.h > b.w * 1.05 ? 0.28 : 0.5));
  } else {
    const zoom = Math.min(3, Math.max(1, p.photo.zoom || 1));
    const s = Math.max(b.w / img.width, b.h / img.height) * zoom;
    const dw = img.width * s;
    const dh = img.height * s;
    const fx = Math.max(-1, Math.min(1, p.photo.x || 0));
    const fy = Math.max(-1, Math.min(1, p.photo.y || 0));
    const dx = b.x - (dw - b.w) / 2 - (fx * (dw - b.w)) / 2;
    const dy = b.y - (dh - b.h) / 2 - (fy * (dh - b.h)) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  }
  ctx.restore();
}

function vGradient(ctx: Ctx, b: Box, from: string, to: string) {
  const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
  g.addColorStop(0, from);
  g.addColorStop(1, to);
  ctx.fillStyle = g;
  ctx.fillRect(b.x, b.y, b.w, b.h);
}

// ---------------------------------------------------------------------------
// Texte : retour à la ligne + taille auto-ajustée
// ---------------------------------------------------------------------------
function wrap(ctx: Ctx, text: string, maxW: number) {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width <= maxW || !line) line = test;
      else {
        lines.push(line);
        line = w;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

type TextOpts = {
  maxSize: number;
  minSize?: number;
  weight?: number;
  lineHeight?: number;
  align?: CanvasTextAlign;
  color: string;
  maxLines?: number;
  valign?: "top" | "middle" | "bottom";
  upper?: boolean;
  shadow?: boolean;
};

/** Dessine le texte dans la boîte, en réduisant la taille jusqu'à ce qu'il tienne. Renvoie la hauteur utilisée. */
function textBox(ctx: Ctx, raw: string, b: Box, o: TextOpts) {
  const text = (o.upper ? raw.toUpperCase() : raw).trim();
  if (!text) return 0;
  const weight = o.weight ?? 800;
  const lh = o.lineHeight ?? 1.08;
  const min = o.minSize ?? Math.max(12, o.maxSize * 0.35);
  let size = o.maxSize;
  let lines: string[] = [];
  for (; size >= min; size -= Math.max(1, size * 0.04)) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    lines = wrap(ctx, text, b.w);
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (lines.length * size * lh <= b.h && widest <= b.w && (!o.maxLines || lines.length <= o.maxLines)) break;
  }
  ctx.font = `${weight} ${size}px ${FONT}`;
  const fit = Math.max(1, Math.min(lines.length, Math.floor(b.h / (size * lh)), o.maxLines ?? 99));
  if (lines.length > fit) {
    lines = lines.slice(0, fit);
    let last = lines[fit - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > b.w) last = last.slice(0, -1);
    lines[fit - 1] = `${last.trimEnd()}…`;
  }
  const total = lines.length * size * lh;
  let y = b.y;
  if (o.valign === "middle") y = b.y + (b.h - total) / 2;
  if (o.valign === "bottom") y = b.y + b.h - total;
  const x = o.align === "center" ? b.x + b.w / 2 : o.align === "right" ? b.x + b.w : b.x;

  ctx.save();
  ctx.fillStyle = o.color;
  ctx.textAlign = o.align ?? "left";
  ctx.textBaseline = "top";
  if (o.shadow) {
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = size * 0.25;
    ctx.shadowOffsetY = size * 0.05;
  }
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * size * lh + size * (lh - 1) * 0.5));
  ctx.restore();
  return total;
}

/** Pastille de texte (badge, appel à l'action). Renvoie sa boîte. */
function pill(
  ctx: Ctx,
  raw: string,
  x: number,
  y: number,
  size: number,
  bg: string,
  fg: string,
  align: "left" | "center" | "right" = "left",
  maxW = Infinity,
  outline = false,
): Box | null {
  const text = raw.trim();
  if (!text) return null;
  let s = size;
  ctx.font = `700 ${s}px ${FONT}`;
  while (ctx.measureText(text).width + s * 1.8 > maxW && s > 10) {
    s -= 1;
    ctx.font = `700 ${s}px ${FONT}`;
  }
  const w = ctx.measureText(text).width + s * 1.8;
  const h = s * 2.1;
  const bx = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
  ctx.save();
  roundRect(ctx, bx, y, w, h, h / 2);
  if (outline) {
    ctx.strokeStyle = bg;
    ctx.lineWidth = Math.max(2, s * 0.12);
    ctx.stroke();
  } else {
    ctx.fillStyle = bg;
    ctx.fill();
  }
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, bx + w / 2, y + h / 2 + s * 0.04);
  ctx.restore();
  return { x: bx, y, w, h };
}

// ---------------------------------------------------------------------------
// Mise en page commune
// ---------------------------------------------------------------------------
function frame(W: number, H: number) {
  const u = Math.min(W, H) / 100;
  const story = H / W > 1.5;
  const wide = W / H > 1.3;
  const m = u * 7;
  // Zones de sécurité Stories / Reels : rien d'important sous l'interface de l'application.
  const top = story ? H * 0.13 : m;
  const bottom = story ? H * 0.17 : m;
  return { u, story, wide, m, top, bottom, inner: { x: m, y: top, w: W - 2 * m, h: H - top - bottom } };
}

export function drawLogo(ctx: Ctx, W: number, H: number, p: RenderParams, fallback: LogoPosition) {
  const pos = p.logo.position === "none" ? "none" : p.logo.position || fallback;
  const img = p.logo.img;
  if (!img || !img.width || pos === "none") return;
  const f = frame(W, H);
  const box = f.u * (f.wide ? 16 : 14);
  const pad = box * 0.12;
  const ratio = img.width / img.height;
  const lw = ratio >= 1 ? box : box * ratio;
  const lh = ratio >= 1 ? box / ratio : box;
  const bw = lw + pad * 2;
  const bh = lh + pad * 2;
  const x = pos.endsWith("l") ? f.m : W - f.m - bw;
  const y = pos.startsWith("t") ? (f.story ? f.top * 0.55 : f.m) : H - (f.story ? f.bottom * 0.55 : f.m) - bh;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.18)";
  ctx.shadowBlur = f.u * 2;
  roundRect(ctx, x, y, bw, bh, f.u * 2.2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();
  ctx.drawImage(img, x + pad, y + pad, lw, lh);
}

// ---------------------------------------------------------------------------
// Les 12 modèles (2 par catégorie)
// ---------------------------------------------------------------------------
export const TEMPLATES: Template[] = [
  {
    id: "promo-bandeau",
    name: "Bandeau promo",
    category: "promotion",
    usesPhoto: true,
    logo: "tl",
    draw(ctx, W, H, p) {
      const f = frame(W, H);
      drawPhoto(ctx, p, { x: 0, y: 0, w: W, h: H });
      const panelY = f.wide ? H * 0.32 : H * 0.42;
      vGradient(ctx, { x: 0, y: panelY, w: W, h: H - panelY }, alpha(p.colors.primary, 0), alpha(p.colors.primary, 0.96));
      if (p.badge.trim()) {
        const r = f.u * (f.wide ? 13 : 15);
        const cx = W - f.m - r;
        const cy = f.top + r;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-0.18);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = p.colors.secondary;
        ctx.fill();
        textBox(ctx, p.badge, { x: -r * 0.78, y: -r * 0.6, w: r * 1.56, h: r * 1.2 }, { maxSize: r * 0.6, color: onColor(p.colors.secondary), align: "center", valign: "middle", upper: true, maxLines: p.badge.trim().length <= 9 ? 1 : 3 });
        ctx.restore();
      }
      const fg = onColor(p.colors.primary);
      const ctaH = p.cta.trim() ? f.u * 10 : 0;
      const textW = f.wide ? W * 0.62 : f.inner.w;
      const bottomY = H - f.bottom - ctaH;
      const subH = p.subtitle.trim() ? textBox(ctx, p.subtitle, { x: f.m, y: bottomY - f.u * 13, w: textW, h: f.u * 11 }, { maxSize: f.u * 5, weight: 500, color: fg, valign: "bottom", maxLines: 2 }) : 0;
      textBox(ctx, p.title, { x: f.m, y: H * (f.wide ? 0.36 : 0.5), w: textW, h: bottomY - (subH ? subH + f.u * 3 : 0) - f.u * 2 - H * (f.wide ? 0.36 : 0.5) }, { maxSize: f.u * (f.wide ? 13 : 12), color: fg, valign: "bottom", shadow: true });
      if (p.cta.trim()) pill(ctx, p.cta, f.m, H - f.bottom - f.u * 8.5, f.u * 3.8, "#ffffff", p.colors.primary, "left", textW);
    },
  },
  {
    id: "promo-split",
    name: "Promo partagée",
    category: "promotion",
    usesPhoto: true,
    logo: "tr",
    draw(ctx, W, H, p) {
      const f = frame(W, H);
      const fg = onColor(p.colors.primary);
      let photo: Box;
      let text: Box;
      if (f.wide) {
        photo = { x: W * 0.45, y: 0, w: W * 0.55, h: H };
        text = { x: f.m, y: f.m, w: W * 0.45 - f.m * 1.6, h: H - 2 * f.m };
      } else {
        photo = { x: 0, y: 0, w: W, h: H * 0.56 };
        text = { x: f.m, y: H * 0.56 + f.u * 6, w: W - 2 * f.m, h: H * 0.44 - f.u * 6 - f.bottom };
      }
      ctx.fillStyle = p.colors.primary;
      ctx.fillRect(0, 0, W, H);
      drawPhoto(ctx, p, photo);
      if (p.badge.trim()) pill(ctx, p.badge, photo.x + f.u * 4, (f.story ? f.top : f.u * 4) + (f.wide ? 0 : 0), f.u * 4.2, p.colors.secondary, onColor(p.colors.secondary));
      const ctaH = p.cta.trim() ? f.u * 11 : 0;
      const subH = p.subtitle.trim() ? f.u * (f.wide ? 16 : 10) : 0;
      textBox(ctx, p.title, { x: text.x, y: text.y, w: text.w, h: text.h - ctaH - subH }, { maxSize: f.u * (f.wide ? 11 : 10), color: fg, valign: f.wide ? "middle" : "top" });
      if (subH) textBox(ctx, p.subtitle, { x: text.x, y: text.y + text.h - ctaH - subH, w: text.w, h: subH - f.u * 2 }, { maxSize: f.u * 4.6, weight: 500, color: alpha(fg === "#ffffff" ? "#ffffff" : fg, 0.9), maxLines: 3 });
      if (ctaH) pill(ctx, p.cta, text.x, text.y + text.h - f.u * 8.5, f.u * 3.8, "#ffffff", p.colors.primary, "left", text.w);
    },
  },
  {
    id: "nouveau-badge",
    name: "Nouveauté plein cadre",
    category: "nouveaute",
    usesPhoto: true,
    logo: "tr",
    draw(ctx, W, H, p) {
      const f = frame(W, H);
      drawPhoto(ctx, p, { x: 0, y: 0, w: W, h: H });
      vGradient(ctx, { x: 0, y: H * 0.35, w: W, h: H * 0.65 }, "rgba(10,10,20,0)", "rgba(10,10,20,0.82)");
      pill(ctx, p.badge || "Nouveau", f.m, f.top, f.u * 4.6, p.colors.secondary, onColor(p.colors.secondary));
      const textW = f.wide ? W * 0.65 : f.inner.w;
      const ctaH = p.cta.trim() ? f.u * 11 : 0;
      const subH = p.subtitle.trim() ? f.u * 9 : 0;
      textBox(ctx, p.title, { x: f.m, y: H * 0.45, w: textW, h: H * 0.55 - f.bottom - ctaH - subH - f.u * 2 }, { maxSize: f.u * 12, color: "#ffffff", valign: "bottom", shadow: true });
      if (subH) textBox(ctx, p.subtitle, { x: f.m, y: H - f.bottom - ctaH - subH, w: textW, h: subH - f.u * 1.5 }, { maxSize: f.u * 4.6, weight: 500, color: "rgba(255,255,255,0.92)", maxLines: 2 });
      if (ctaH) pill(ctx, p.cta, f.m, H - f.bottom - f.u * 8.5, f.u * 3.8, p.colors.primary, onColor(p.colors.primary), "left", textW);
    },
  },
  {
    id: "nouveau-cadre",
    name: "Nouveauté encadrée",
    category: "nouveaute",
    usesPhoto: true,
    logo: "br",
    draw(ctx, W, H, p) {
      const f = frame(W, H);
      const fg = onColor(p.colors.primary);
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, p.colors.primary);
      g.addColorStop(1, mix(p.colors.primary, p.colors.secondary, 0.55));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      let card: Box;
      let text: Box;
      if (f.wide) {
        card = { x: W * 0.52, y: f.m, w: W * 0.48 - f.m, h: H - 2 * f.m };
        text = { x: f.m, y: f.m, w: W * 0.52 - f.m * 1.8, h: H - 2 * f.m };
      } else {
        const ch = f.inner.h * (f.story ? 0.56 : H / W > 1.1 ? 0.5 : 0.44);
        card = { x: f.m, y: f.top + f.inner.h - ch, w: f.inner.w, h: ch };
        text = { x: f.m, y: f.top, w: f.inner.w, h: f.inner.h - ch - f.u * 4 };
      }
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.25)";
      ctx.shadowBlur = f.u * 4;
      roundRect(ctx, card.x, card.y, card.w, card.h, f.u * 4);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.restore();
      const b = f.u * 1.6;
      drawPhoto(ctx, p, { x: card.x + b, y: card.y + b, w: card.w - 2 * b, h: card.h - 2 * b }, f.u * 3);
      const badgeBox = pill(ctx, p.badge || "Nouveau", text.x, text.y, f.u * 4, "#ffffff", p.colors.primary);
      const top = text.y + (badgeBox ? badgeBox.h + f.u * 3 : 0);
      const ctaH = p.cta.trim() ? f.u * 10 : 0;
      // Le titre garde toujours une place lisible : le sous-titre cède s'il manque d'espace.
      const room = text.y + text.h - top - ctaH;
      const subH = p.subtitle.trim() && room > f.u * 26 ? f.u * (f.wide ? 14 : 8) : 0;
      textBox(ctx, p.title, { x: text.x, y: top, w: text.w, h: room - subH }, { maxSize: f.u * 10, color: fg, valign: f.wide ? "middle" : "top" });
      if (subH) textBox(ctx, p.subtitle, { x: text.x, y: text.y + text.h - subH - ctaH, w: text.w, h: subH - f.u }, { maxSize: f.u * 4.4, weight: 500, color: fg, maxLines: 3 });
      if (ctaH) pill(ctx, p.cta, text.x, text.y + text.h - f.u * 8, f.u * 3.6, p.colors.secondary, onColor(p.colors.secondary), "left", text.w);
    },
  },
  {
    id: "produit-focus",
    name: "Produit en vedette",
    category: "produit",
    usesPhoto: true,
    logo: "tl",
    draw(ctx, W, H, p) {
      const f = frame(W, H);
      ctx.fillStyle = mix(p.colors.secondary, "#ffffff", 0.86);
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = mix(p.colors.secondary, "#ffffff", 0.7);
      ctx.beginPath();
      ctx.arc(W * 0.85, H * 0.12, Math.min(W, H) * 0.32, 0, Math.PI * 2);
      ctx.fill();
      const dark = p.colors.text;
      if (f.wide) {
        const d = H - 2 * f.m;
        drawPhoto(ctx, p, { x: W - f.m - d, y: f.m, w: d, h: d }, 0, "circle");
        const tw = W - d - f.m * 3;
        textBox(ctx, p.title, { x: f.m, y: f.m, w: tw, h: H * 0.55 }, { maxSize: f.u * 11, color: dark, valign: "bottom" });
        textBox(ctx, p.subtitle, { x: f.m, y: f.m + H * 0.58, w: tw, h: H * 0.16 }, { maxSize: f.u * 5, weight: 600, color: p.colors.primary, maxLines: 2 });
        pill(ctx, p.cta, f.m, H - f.m - f.u * 8.5, f.u * 3.8, p.colors.primary, onColor(p.colors.primary), "left", tw);
      } else {
        const d = Math.min(f.inner.w * 0.86, f.inner.h * 0.56);
        drawPhoto(ctx, p, { x: (W - d) / 2, y: f.top + f.u * 3, w: d, h: d }, 0, "circle");
        const y = f.top + f.u * 3 + d + f.u * 5;
        const ctaH = p.cta.trim() ? f.u * 11 : 0;
        const avail = H - f.bottom - y - ctaH;
        const used = textBox(ctx, p.title, { x: f.m, y, w: f.inner.w, h: avail * 0.62 }, { maxSize: f.u * 9, color: dark, align: "center" });
        textBox(ctx, p.subtitle, { x: f.m, y: y + used + f.u * 2, w: f.inner.w, h: avail - used - f.u * 2 }, { maxSize: f.u * 4.6, weight: 600, color: p.colors.primary, align: "center", maxLines: 2 });
        pill(ctx, p.cta, W / 2, H - f.bottom - f.u * 8.5, f.u * 3.8, p.colors.primary, onColor(p.colors.primary), "center", f.inner.w);
      }
      if (p.badge.trim()) pill(ctx, p.badge, W - f.m, f.top, f.u * 3.8, p.colors.secondary, onColor(p.colors.secondary), "right");
    },
  },
  {
    id: "produit-minimal",
    name: "Produit épuré",
    category: "produit",
    usesPhoto: true,
    logo: "tl",
    draw(ctx, W, H, p) {
      const f = frame(W, H);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);
      let text: Box;
      if (f.wide) {
        drawPhoto(ctx, p, { x: 0, y: 0, w: W * 0.6, h: H });
        text = { x: W * 0.6 + f.m, y: f.m, w: W * 0.4 - f.m * 2, h: H - 2 * f.m };
      } else {
        const ph = f.story ? H * 0.52 : H * 0.58;
        drawPhoto(ctx, p, { x: 0, y: 0, w: W, h: ph });
        text = { x: f.m, y: ph + f.u * 5, w: f.inner.w, h: H - ph - f.u * 5 - f.bottom };
      }
      ctx.fillStyle = p.colors.primary;
      ctx.fillRect(text.x, text.y, f.u * 10, f.u * 1.2);
      const top = text.y + f.u * 4;
      const ctaH = p.cta.trim() ? f.u * 10 : 0;
      const used = textBox(ctx, p.title, { x: text.x, y: top, w: text.w, h: (text.h - f.u * 4 - ctaH) * 0.66 }, { maxSize: f.u * (f.wide ? 8 : 10), color: p.colors.text });
      textBox(ctx, p.subtitle, { x: text.x, y: top + used + f.u * 2, w: text.w, h: text.y + text.h - ctaH - (top + used + f.u * 2) }, { maxSize: f.u * 4.4, weight: 500, color: mix(p.colors.text, "#ffffff", 0.3), maxLines: 3 });
      if (ctaH) pill(ctx, p.cta, text.x, text.y + text.h - f.u * 8, f.u * 3.6, p.colors.primary, onColor(p.colors.primary), "left", text.w);
      if (p.badge.trim()) pill(ctx, p.badge, (f.wide ? W * 0.6 : W) - f.m, f.story ? f.top : f.m, f.u * 3.8, p.colors.secondary, onColor(p.colors.secondary), "right");
    },
  },
  {
    id: "service-liste",
    name: "Service mis en avant",
    category: "service",
    usesPhoto: true,
    logo: "tl",
    draw(ctx, W, H, p) {
      const f = frame(W, H);
      const fg = onColor(p.colors.primary);
      ctx.fillStyle = p.colors.primary;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = alpha("#ffffff", 0.07);
      ctx.beginPath();
      ctx.arc(0, H, Math.max(W, H) * 0.55, 0, Math.PI * 2);
      ctx.fill();
      let photo: Box;
      let text: Box;
      if (f.wide) {
        photo = { x: W * 0.55, y: f.m, w: W * 0.45 - f.m, h: H - 2 * f.m };
        text = { x: f.m, y: f.m + f.u * 14, w: W * 0.55 - f.m * 2, h: H - 2 * f.m - f.u * 14 };
      } else {
        const ph = f.inner.h * 0.5;
        photo = { x: f.m, y: f.top + f.inner.h - ph, w: f.inner.w, h: ph };
        text = { x: f.m, y: f.top + f.u * 16, w: f.inner.w, h: f.inner.h - ph - f.u * 20 };
      }
      drawPhoto(ctx, p, photo, f.u * 4);
      if (p.badge.trim()) pill(ctx, p.badge, text.x, text.y - f.u * 4, f.u * 3.6, p.colors.secondary, onColor(p.colors.secondary));
      const subH = p.subtitle.trim() ? text.h * 0.38 : 0;
      const used = textBox(ctx, p.title, { x: text.x, y: text.y + f.u * 4, w: text.w, h: text.h - subH - f.u * 4 }, { maxSize: f.u * 9.5, color: fg });
      if (subH) textBox(ctx, p.subtitle, { x: text.x, y: text.y + f.u * 6 + used, w: text.w, h: text.h - used - f.u * 6 }, { maxSize: f.u * 4.4, weight: 500, color: fg, maxLines: 4 });
      if (p.cta.trim()) pill(ctx, p.cta, photo.x + photo.w - f.u * 3, photo.y + photo.h - f.u * 11, f.u * 3.6, "#ffffff", p.colors.primary, "right", photo.w - f.u * 6);
    },
  },
  {
    id: "service-elegant",
    name: "Service élégant",
    category: "service",
    usesPhoto: true,
    logo: "bl",
    draw(ctx, W, H, p) {
      const f = frame(W, H);
      drawPhoto(ctx, p, { x: 0, y: 0, w: W, h: H });
      ctx.fillStyle = "rgba(12,10,24,0.5)";
      ctx.fillRect(0, 0, W, H);
      const tw = f.wide ? W * 0.7 : f.inner.w * 0.9;
      const cx = W / 2;
      const titleH = f.wide ? H * 0.42 : f.inner.h * 0.36;
      const y0 = H / 2 - titleH / 2 - f.u * 4;
      ctx.fillStyle = p.colors.secondary;
      ctx.fillRect(cx - f.u * 8, y0 - f.u * 5, f.u * 16, f.u * 0.8);
      if (p.badge.trim()) textBox(ctx, p.badge, { x: cx - tw / 2, y: y0 - f.u * 11, w: tw, h: f.u * 5 }, { maxSize: f.u * 3.4, weight: 700, color: p.colors.secondary, align: "center", upper: true, maxLines: 1 });
      textBox(ctx, p.title, { x: cx - tw / 2, y: y0, w: tw, h: titleH }, { maxSize: f.u * 11, color: "#ffffff", align: "center", valign: "middle", weight: 700, shadow: true });
      ctx.fillStyle = p.colors.secondary;
      ctx.fillRect(cx - f.u * 8, y0 + titleH + f.u * 4, f.u * 16, f.u * 0.8);
      textBox(ctx, p.subtitle, { x: cx - tw / 2, y: y0 + titleH + f.u * 8, w: tw, h: f.u * 12 }, { maxSize: f.u * 4.4, weight: 500, color: "rgba(255,255,255,0.92)", align: "center", maxLines: 2 });
      pill(ctx, p.cta, cx, H - f.bottom - f.u * 9, f.u * 3.8, "#ffffff", "#ffffff", "center", tw, true);
    },
  },
  {
    id: "evenement-affiche",
    name: "Affiche événement",
    category: "evenement",
    usesPhoto: true,
    logo: "tr",
    draw(ctx, W, H, p) {
      const f = frame(W, H);
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, p.colors.primary);
      g.addColorStop(1, mix(p.colors.primary, p.colors.secondary, 0.7));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      const fg = onColor(p.colors.primary);
      let photo: Box;
      let text: Box;
      if (f.wide) {
        photo = { x: W * 0.6, y: 0, w: W * 0.4, h: H };
        text = { x: f.m, y: f.m, w: W * 0.6 - f.m * 2, h: H - 2 * f.m };
      } else {
        const ph = f.story ? H * 0.34 : H * 0.36;
        photo = { x: 0, y: H - ph, w: W, h: ph };
        text = { x: f.m, y: f.top, w: f.inner.w, h: H - ph - f.top - f.u * 5 };
      }
      drawPhoto(ctx, p, photo);
      const badgeBox = p.badge.trim() ? pill(ctx, p.badge, text.x, text.y, f.u * 5, "#ffffff", p.colors.primary, "left", text.w) : null;
      const top = text.y + (badgeBox ? badgeBox.h + f.u * 4 : 0);
      const ctaH = p.cta.trim() ? f.u * 11 : 0;
      const subH = p.subtitle.trim() ? f.u * 11 : 0;
      textBox(ctx, p.title, { x: text.x, y: top, w: text.w, h: text.y + text.h - top - subH - ctaH }, { maxSize: f.u * 14, color: fg, upper: true, lineHeight: 1.02, weight: 900 });
      if (subH) textBox(ctx, p.subtitle, { x: text.x, y: text.y + text.h - subH - ctaH, w: text.w, h: subH - f.u }, { maxSize: f.u * 4.8, weight: 600, color: fg, maxLines: 2 });
      if (ctaH) pill(ctx, p.cta, text.x, text.y + text.h - f.u * 8.5, f.u * 3.8, p.colors.secondary, onColor(p.colors.secondary), "left", text.w);
    },
  },
  {
    id: "evenement-ticket",
    name: "Billet événement",
    category: "evenement",
    usesPhoto: true,
    logo: "tl",
    draw(ctx, W, H, p) {
      const f = frame(W, H);
      ctx.fillStyle = mix(p.colors.primary, "#000000", 0.15);
      ctx.fillRect(0, 0, W, H);
      drawPhoto(ctx, p, { x: 0, y: 0, w: W, h: f.wide ? H : H * 0.6 });
      let t: Box;
      if (f.wide) t = { x: W * 0.5, y: f.m, w: W * 0.5 - f.m, h: H - 2 * f.m };
      else t = { x: f.m, y: H * 0.5, w: W - 2 * f.m, h: H * 0.5 - f.bottom };
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.3)";
      ctx.shadowBlur = f.u * 4;
      roundRect(ctx, t.x, t.y, t.w, t.h, f.u * 4);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.restore();
      const stubH = Math.min(t.h * 0.26, f.u * 16);
      const ly = t.y + t.h - stubH;
      ctx.fillStyle = f.wide ? mix(p.colors.primary, "#000000", 0.15) : mix(p.colors.primary, "#000000", 0.15);
      [t.x, t.x + t.w].forEach((cx) => {
        ctx.beginPath();
        ctx.arc(cx, ly, f.u * 2.6, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.save();
      ctx.setLineDash([f.u * 1.6, f.u * 1.2]);
      ctx.strokeStyle = mix(p.colors.text, "#ffffff", 0.7);
      ctx.lineWidth = Math.max(2, f.u * 0.4);
      ctx.beginPath();
      ctx.moveTo(t.x + f.u * 4, ly);
      ctx.lineTo(t.x + t.w - f.u * 4, ly);
      ctx.stroke();
      ctx.restore();
      const pad = f.u * 5;
      const inner = { x: t.x + pad, y: t.y + pad, w: t.w - 2 * pad, h: ly - t.y - pad * 1.5 };
      const bb = p.badge.trim() ? pill(ctx, p.badge, inner.x, inner.y, f.u * 3.6, p.colors.primary, onColor(p.colors.primary), "left", inner.w) : null;
      const top = inner.y + (bb ? bb.h + f.u * 3 : 0);
      const subH = p.subtitle.trim() ? (inner.y + inner.h - top) * 0.32 : 0;
      textBox(ctx, p.title, { x: inner.x, y: top, w: inner.w, h: inner.y + inner.h - top - subH }, { maxSize: f.u * 9, color: p.colors.text });
      if (subH) textBox(ctx, p.subtitle, { x: inner.x, y: inner.y + inner.h - subH, w: inner.w, h: subH }, { maxSize: f.u * 4.2, weight: 600, color: p.colors.primary, maxLines: 2, valign: "bottom" });
      textBox(ctx, p.cta, { x: t.x + pad, y: ly + f.u * 2, w: t.w - 2 * pad, h: stubH - f.u * 4 }, { maxSize: f.u * 4.2, weight: 800, color: p.colors.primary, align: "center", valign: "middle", maxLines: 1, upper: true });
    },
  },
  {
    id: "annonce-texte",
    name: "Annonce typographique",
    category: "annonce",
    usesPhoto: false,
    logo: "bl",
    draw(ctx, W, H, p) {
      const f = frame(W, H);
      const fg = onColor(p.colors.primary);
      ctx.fillStyle = p.colors.primary;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = alpha(p.colors.secondary, 0.55);
      ctx.beginPath();
      ctx.arc(W, 0, Math.min(W, H) * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = alpha("#ffffff", 0.1);
      ctx.font = `900 ${f.u * 40}px ${FONT}`;
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      ctx.fillText("«", f.m - f.u * 2, f.top - f.u * 10);
      const tw = f.wide ? W * 0.8 : f.inner.w;
      const bb = p.badge.trim() ? pill(ctx, p.badge, f.m, f.top + f.u * 4, f.u * 3.8, "#ffffff", p.colors.primary) : null;
      const top = f.top + f.u * 4 + (bb ? bb.h + f.u * 5 : f.u * 8);
      const ctaH = p.cta.trim() ? f.u * 12 : 0;
      const subH = p.subtitle.trim() ? f.u * 14 : 0;
      textBox(ctx, p.title, { x: f.m, y: top, w: tw, h: H - f.bottom - top - ctaH - subH }, { maxSize: f.u * 15, color: fg, valign: "middle", weight: 900, lineHeight: 1.02 });
      if (subH) textBox(ctx, p.subtitle, { x: f.m, y: H - f.bottom - ctaH - subH, w: tw, h: subH - f.u * 2 }, { maxSize: f.u * 4.8, weight: 500, color: fg, maxLines: 3 });
      if (ctaH) pill(ctx, p.cta, W - f.m, H - f.bottom - f.u * 9, f.u * 3.8, "#ffffff", p.colors.primary, "right", tw);
    },
  },
  {
    id: "annonce-cadre",
    name: "Annonce encadrée",
    category: "annonce",
    usesPhoto: false,
    logo: "tl",
    draw(ctx, W, H, p) {
      const f = frame(W, H);
      ctx.fillStyle = mix(p.colors.secondary, "#ffffff", 0.9);
      ctx.fillRect(0, 0, W, H);
      const inset = f.u * 4;
      const fr = { x: inset, y: f.story ? f.top - inset : inset, w: W - 2 * inset, h: f.story ? H - f.top - f.bottom + 2 * inset : H - 2 * inset };
      ctx.strokeStyle = p.colors.primary;
      ctx.lineWidth = f.u * 1.6;
      roundRect(ctx, fr.x, fr.y, fr.w, fr.h, f.u * 3);
      ctx.stroke();
      const pad = f.u * 8;
      const box = { x: fr.x + pad, y: fr.y + pad, w: fr.w - 2 * pad, h: fr.h - 2 * pad };
      let top = box.y;
      const logo = p.logo.img;
      if (logo && logo.width && p.logo.position !== "none") {
        const lh = f.u * (f.wide ? 16 : 18);
        const lw = Math.min(box.w * 0.6, lh * (logo.width / logo.height));
        const h = lw / (logo.width / logo.height);
        ctx.drawImage(logo, W / 2 - lw / 2, top, lw, h);
        top += h + f.u * 5;
      }
      if (p.badge.trim()) {
        textBox(ctx, p.badge, { x: box.x, y: top, w: box.w, h: f.u * 5 }, { maxSize: f.u * 3.6, weight: 700, color: p.colors.primary, align: "center", upper: true, maxLines: 1 });
        top += f.u * 8;
      }
      const ctaH = p.cta.trim() ? f.u * 12 : 0;
      const subH = p.subtitle.trim() ? f.u * 13 : 0;
      textBox(ctx, p.title, { x: box.x, y: top, w: box.w, h: box.y + box.h - top - ctaH - subH }, { maxSize: f.u * 11, color: p.colors.text, align: "center", valign: "middle" });
      if (subH) textBox(ctx, p.subtitle, { x: box.x, y: box.y + box.h - ctaH - subH, w: box.w, h: subH - f.u * 2 }, { maxSize: f.u * 4.6, weight: 500, color: mix(p.colors.text, "#ffffff", 0.25), align: "center", maxLines: 3 });
      if (ctaH) pill(ctx, p.cta, W / 2, box.y + box.h - f.u * 9, f.u * 3.8, p.colors.primary, onColor(p.colors.primary), "center", box.w);
    },
  },
];

export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];

/** Rendu complet d'un visuel dans un canvas aux dimensions finales. */
export function renderVisual(canvas: HTMLCanvasElement, W: number, H: number, templateId: string, p: RenderParams) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, W, H);
  ctx.imageSmoothingQuality = "high";
  const t = templateById(templateId);
  t.draw(ctx, W, H, p);
  if (t.id !== "annonce-cadre") drawLogo(ctx, W, H, p, t.logo);
}
