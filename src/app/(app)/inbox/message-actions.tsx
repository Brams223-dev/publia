"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, MailOpen, Trash2 } from "lucide-react";
import { deleteMessage, setMessageStatus } from "./actions";

export function MessageActions({ id, status }: { id: string; status: "new" | "read" | "archived" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>, back = false) =>
    start(async () => {
      await fn();
      router.push(back ? "/inbox" : `/inbox?message=${id}`);
      router.refresh();
    });
  return (
    <div className="flex gap-2">
      {status !== "archived" ? (
        <button type="button" className="btn-ghost px-3 py-1.5 text-xs" disabled={pending} onClick={() => run(() => setMessageStatus(id, "archived"), true)}><Archive className="size-3.5" /> Archiver</button>
      ) : (
        <button type="button" className="btn-ghost px-3 py-1.5 text-xs" disabled={pending} onClick={() => run(() => setMessageStatus(id, "read"))}>Désarchiver</button>
      )}
      <button type="button" className="btn-ghost px-3 py-1.5 text-xs" disabled={pending} onClick={() => run(() => setMessageStatus(id, "new"), true)}><MailOpen className="size-3.5" /> Non lu</button>
      <button
        type="button"
        aria-label="Supprimer le message"
        className="btn-ghost px-3 py-1.5 text-xs text-danger hover:border-danger"
        disabled={pending}
        onClick={() => {
          if (window.confirm("Supprimer définitivement ce message ?")) run(() => deleteMessage(id), true);
        }}
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
