"use client";

import { useState } from "react";
import { Copy } from "lucide-react";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <input readOnly value={url} className="input py-2 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} aria-label="Lien de dépôt d'avis" />
      <button type="button" className="btn-ghost px-3" onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); }}>
        <Copy className="size-4" /> {copied ? "Copié" : "Copier"}
      </button>
    </div>
  );
}
