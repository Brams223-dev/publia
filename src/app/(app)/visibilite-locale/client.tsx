"use client";

import { useState, useTransition } from "react";
import { Check, Copy } from "lucide-react";
import { setDeclaredCheck } from "./actions";

export function DeclaredCheck({ id, done, disabled }: { id: string; done: boolean; disabled: boolean }) {
  const [value, setValue] = useState(done);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={value}
      disabled={disabled || pending}
      onClick={() => {
        const next = !value;
        setValue(next);
        start(async () => {
          const r = await setDeclaredCheck(id, next);
          if (r.error) setValue(!next);
        });
      }}
      className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border ${value ? "border-brand bg-brand text-white" : "border-line bg-white"} disabled:opacity-60`}
    >
      {value ? <Check className="size-3.5" /> : null}
    </button>
  );
}

export function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-start gap-2">
      <pre className="min-w-0 flex-1 rounded-xl bg-canvas p-3 text-sm whitespace-pre-wrap">{text}</pre>
      <button type="button" className="btn-ghost px-3" onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); }}>
        <Copy className="size-4" /> {copied ? "Copié" : "Copier"}
      </button>
    </div>
  );
}
