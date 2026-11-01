"use client";

import { useTransition } from "react";
import { CheckCheck, Trash2 } from "lucide-react";
import { deleteCampaign, validateCampaign } from "../actions";

export function CampaignActions({ id, allReady }: { id: string; allReady: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      {!allReady && (
        <button type="button" className="btn-primary" disabled={pending} onClick={() => start(() => validateCampaign(id).then(() => {}))}>
          <CheckCheck className="size-4" /> Tout valider
        </button>
      )}
      <button
        type="button"
        className="btn-ghost text-danger hover:text-danger"
        disabled={pending}
        onClick={() => {
          if (confirm("Supprimer cette campagne et tous ses contenus ? Cette action est définitive.")) start(() => deleteCampaign(id));
        }}
      >
        <Trash2 className="size-4" /> Supprimer
      </button>
    </div>
  );
}
