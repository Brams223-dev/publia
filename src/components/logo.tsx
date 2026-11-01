import Link from "next/link";

export function Logo({ href = "/", className = "" }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <span
        aria-hidden
        className="grid size-8 place-items-center rounded-xl bg-brand text-white shadow-[0_6px_16px_rgb(107_85_217/0.35)]"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M7 20V5h6a4.5 4.5 0 0 1 0 9H7" />
        </svg>
      </span>
      <span className="text-lg text-ink">Publia</span>
    </Link>
  );
}
