"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { acceptInvitation } from "../../organisation/actions";

export function AcceptButton({ token }: { token: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className="btn-primary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await acceptInvitation(token);
            if (r?.error) setError(r.error);
          })
        }
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Accepter l&apos;invitation
      </button>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
    </>
  );
}
