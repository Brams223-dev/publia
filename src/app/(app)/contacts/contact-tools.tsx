"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Download, FileUp, Loader2, UserPlus } from "lucide-react";
import { ContactForm } from "./contact-form";
import { exportContacts, importContacts, type ImportState } from "./actions";

function ImportSubmit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary" disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />} Importer
    </button>
  );
}

export function ContactTools() {
  const [panel, setPanel] = useState<"none" | "new" | "import">("none");
  const [state, action] = useActionState<ImportState, FormData>(importContacts, undefined);
  const [exporting, start] = useTransition();
  const [exportError, setExportError] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" onClick={() => setPanel(panel === "new" ? "none" : "new")}><UserPlus className="size-4" /> Nouveau contact</button>
        <button type="button" className="btn-ghost" onClick={() => setPanel(panel === "import" ? "none" : "import")}><FileUp className="size-4" /> Importer un fichier</button>
        <button
          type="button"
          className="btn-ghost"
          disabled={exporting}
          onClick={() =>
            start(async () => {
              setExportError(null);
              const r = await exportContacts();
              if (!r.csv) return setExportError(r.error ?? "Export impossible.");
              const url = URL.createObjectURL(new Blob([r.csv], { type: "text/csv;charset=utf-8" }));
              const a = document.createElement("a");
              a.href = url;
              a.download = r.filename ?? "contacts.csv";
              a.click();
              URL.revokeObjectURL(url);
            })
          }
        >
          {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Exporter (CSV)
        </button>
      </div>
      {exportError ? <p className="text-sm text-danger">{exportError}</p> : null}

      {panel === "new" ? (
        <div className="card p-5">
          <ContactForm values={{ first_name: "", last_name: "", email: "", phone: "", tags: "", notes: "", marketing_consent: false, consent_source: "" }} onCancel={() => setPanel("none")} />
        </div>
      ) : null}

      {panel === "import" ? (
        <form action={action} className="card space-y-3 p-5">
          <p className="text-sm text-ink-soft">
            Fichier CSV (Excel : « Enregistrer sous » → CSV). Colonnes reconnues : Prénom, Nom, Email, Téléphone, Étiquettes, Notes,
            Consentement (oui/non). Un contact déjà présent avec le même e-mail est complété, jamais effacé. 2 000 lignes maximum.
          </p>
          <input name="file" type="file" accept=".csv,text/csv" required className="block text-sm" />
          <div>
            <label className="label" htmlFor="consent_source">Si le fichier contient des consentements : comment ont-ils été recueillis ?</label>
            <input id="consent_source" name="consent_source" maxLength={80} className="input" placeholder="Ex. : inscriptions newsletter du site, cartes papier signées" />
          </div>
          <ImportSubmit />
          {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
          {state?.created !== undefined ? (
            <p className="text-sm text-success">{state.created} contact(s) créé(s), {state.updated ?? 0} mis à jour.</p>
          ) : null}
          {state?.skipped?.length ? (
            <details className="text-sm">
              <summary className="cursor-pointer text-ink-soft">{state.skipped.length} ligne(s) ignorée(s)</summary>
              <ul className="mt-1 list-disc pl-5 text-ink-soft">{state.skipped.slice(0, 50).map((s) => <li key={s.line}>Ligne {s.line} : {s.reason}</li>)}</ul>
            </details>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
