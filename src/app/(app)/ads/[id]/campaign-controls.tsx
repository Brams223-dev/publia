"use client";

import { useState, useTransition } from "react";
import { CheckCheck, Lock, RotateCcw, Trash2 } from "lucide-react";
import { deleteAdCampaign, setAdStatus } from "../actions";

export function CampaignControls({ id, status, platformName }: { id: string; status: string; platformName: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (s: "draft" | "ready" | "archived") =>
    start(async () => {
      setError(null);
      const r = await setAdStatus(id, s);
      if (r.error) setError(r.error);
    });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status === "draft" && (
          <button type="button" className="btn-primary" disabled={pending} onClick={() => run("ready")}>
            <CheckCheck className="size-4" /> Valider le brouillon
          </button>
        )}
        {status === "ready" && (
          <button type="button" className="btn-ghost" disabled={pending} onClick={() => run("draft")}>
            <RotateCcw className="size-4" /> Repasser en brouillon
          </button>
        )}
        <button type="button" className="btn-ghost" disabled title={`Connectez d'abord votre compte ${platformName}`}>
          <Lock className="size-4" /> Lancer la campagne
        </button>
        <button
          type="button"
          className="btn-ghost text-danger"
          disabled={pending}
          onClick={() => confirm("Supprimer ce brouillon et ses variantes ?") && start(() => deleteAdCampaign(id))}
        >
          <Trash2 className="size-4" /> Supprimer
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}
