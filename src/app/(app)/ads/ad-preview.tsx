// Prévisualisations génériques par régie (maquettes Publia, sans logo ni marque des plateformes).

type Props = {
  platform: string;
  businessName: string;
  logoUrl: string | null;
  imageUrl: string | null;
  headline: string;
  primaryText: string;
  description: string;
  cta: string;
  url: string | null;
};

function Media({ src, ratio, className = "" }: { src: string | null; ratio: string; className?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={`w-full object-cover ${className}`} style={{ aspectRatio: ratio }} />
  ) : (
    <div className={`grid w-full place-items-center bg-gradient-to-br from-brand-light/60 to-brand/60 text-xs font-semibold text-white ${className}`} style={{ aspectRatio: ratio }}>
      Votre visuel
    </div>
  );
}

function Avatar({ logoUrl, name }: { logoUrl: string | null; name: string }) {
  return logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoUrl} alt="" className="size-8 rounded-full border border-line bg-white object-contain p-0.5" />
  ) : (
    <span className="grid size-8 place-items-center rounded-full bg-brand text-xs font-bold text-white">{name.slice(0, 1).toUpperCase()}</span>
  );
}

const host = (u: string | null) => {
  try {
    return u ? new URL(u).hostname.replace(/^www\./, "") : "votre-site.fr";
  } catch {
    return "votre-site.fr";
  }
};

export function AdPreview(p: Props) {
  if (p.platform === "search")
    return (
      <div className="rounded-xl border border-line bg-white p-4 text-left">
        <p className="text-xs text-ink">
          <span className="font-semibold">Sponsorisé</span> · {host(p.url)}
        </p>
        <p className="mt-1 text-lg leading-snug text-[#1a0dab]">{p.headline} | {p.businessName}</p>
        <p className="mt-1 text-sm text-ink-soft">{p.primaryText} {p.description}</p>
        <p className="mt-2 text-sm font-medium text-[#1a0dab]">{p.cta}</p>
      </div>
    );

  if (p.platform === "vertical")
    return (
      <div className="relative mx-auto aspect-[9/16] w-full max-w-[260px] overflow-hidden rounded-2xl bg-neutral-900 text-left text-white">
        <Media src={p.imageUrl} ratio="9 / 16" className="absolute inset-0 h-full" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3 pt-16">
          <p className="text-sm font-semibold">{p.businessName}</p>
          <p className="mt-1 text-xs leading-snug">{p.primaryText}</p>
          <p className="mt-0.5 text-[10px] opacity-80">Sponsorisé</p>
          <span className="mt-2 block rounded-md bg-white/95 py-2 text-center text-xs font-semibold text-neutral-900">{p.cta}</span>
        </div>
      </div>
    );

  if (p.platform === "video")
    return (
      <div className="overflow-hidden rounded-xl border border-line bg-white text-left">
        <div className="relative">
          <Media src={p.imageUrl} ratio="16 / 9" />
          <span className="absolute bottom-2 left-2 rounded bg-amber-300 px-1.5 py-0.5 text-[10px] font-bold text-neutral-900">Annonce</span>
        </div>
        <div className="flex items-center gap-3 p-3">
          <Avatar logoUrl={p.logoUrl} name={p.businessName} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{p.headline}</p>
            <p className="truncate text-xs text-ink-soft">{p.businessName} · Sponsorisé</p>
          </div>
          <span className="shrink-0 rounded-full bg-[#065fd4] px-3 py-1.5 text-xs font-semibold text-white">{p.cta}</span>
        </div>
      </div>
    );

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white text-left">
      <div className="flex items-center gap-2 p-3">
        <Avatar logoUrl={p.logoUrl} name={p.businessName} />
        <div>
          <p className="text-sm font-semibold leading-tight">{p.businessName}</p>
          <p className="text-[11px] text-ink-soft">Sponsorisé</p>
        </div>
      </div>
      <p className="whitespace-pre-line px-3 pb-3 text-sm">{p.primaryText}</p>
      <Media src={p.imageUrl} ratio="1 / 1" />
      <div className="flex items-center gap-3 bg-canvas px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] uppercase text-ink-soft">{host(p.url)}</p>
          <p className="truncate text-sm font-semibold">{p.headline}</p>
          {p.description && <p className="truncate text-xs text-ink-soft">{p.description}</p>}
        </div>
        <span className="shrink-0 rounded-md bg-neutral-200 px-3 py-1.5 text-xs font-semibold">{p.cta}</span>
      </div>
    </div>
  );
}
