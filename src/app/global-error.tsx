"use client";

// Remplace la mise en page racine en cas d'erreur grave : styles autonomes, sans dépendance.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error && typeof error === "object" && "digest" in error ? String((error as { digest?: unknown }).digest ?? "") : "";
  return (
    <html lang="fr">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#F8F7FC", color: "#25243A", fontFamily: "Inter, system-ui, sans-serif" }}>
        <title>Publia — erreur</title>
        <main style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>Publia est momentanément indisponible</h1>
          <p style={{ color: "#6C6A85", fontSize: 14 }}>Vos données n&apos;ont pas été perdues. Réessayez dans un instant.</p>
          {digest ? <p style={{ color: "#6C6A85", fontSize: 12, fontFamily: "monospace" }}>Référence : {digest}</p> : null}
          <button type="button" onClick={() => retry()} style={{ marginTop: 12, border: 0, borderRadius: 999, padding: "10px 20px", background: "#6B55D9", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
            Réessayer
          </button>
        </main>
      </body>
    </html>
  );
}
