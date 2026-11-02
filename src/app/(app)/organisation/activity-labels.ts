// Libellés lisibles des événements du journal d'audit (module pur, testable).

const ROLE: Record<string, string> = { owner: "propriétaire", admin: "administrateur", member: "employé" };
const FIELD: Record<string, string> = {
  name: "nom", category: "secteur", description: "description", address: "adresse", city: "ville", phone: "téléphone", website: "site",
  tone: "ton", brand_colors: "couleurs", logo_url: "logo", products: "produits", services: "services", target_audience: "clientèle",
  opening_hours: "horaires", social_links: "réseaux sociaux", goals: "objectifs",
};
const s = (v: unknown) => (typeof v === "string" ? v : "");

/** Phrase lisible pour chaque type d'événement du journal. */
export function describe(e: { action: string; details: Record<string, unknown> }): string {
  const d = e.details;
  switch (e.action) {
    case "member.added": return `${s(d.email)} a rejoint l'organisation (${ROLE[s(d.role)] ?? s(d.role)})`;
    case "member.removed": return `${s(d.email)} a été retiré de l'organisation`;
    case "member.left": return `${s(d.email)} a quitté l'organisation`;
    case "member.role_changed": return `Rôle de ${s(d.email)} : ${ROLE[s(d.from)] ?? s(d.from)} → ${ROLE[s(d.to)] ?? s(d.to)}`;
    case "invitation.created": return `Invitation envoyée à ${s(d.email)} (${ROLE[s(d.role)] ?? s(d.role)})`;
    case "invitation.accepted": return `Invitation acceptée par ${s(d.email)}`;
    case "invitation.revoked": return `Invitation de ${s(d.email)} annulée`;
    case "organization.renamed": return `Organisation renommée en « ${s(d.to)} »`;
    case "business.created": return `Commerce « ${s(d.name)} » créé`;
    case "business.deleted": return `Commerce « ${s(d.name)} » supprimé`;
    case "business.updated": {
      const f = Array.isArray(d.fields) ? (d.fields as string[]).map((x) => FIELD[x] ?? x) : [];
      return `Informations du commerce modifiées${f.length ? ` : ${f.join(", ")}` : ""}`;
    }
    case "product.deleted": return `Produit « ${s(d.name)} » supprimé`;
    case "product.activated": return `Produit « ${s(d.name)} » activé`;
    case "product.archived": return `Produit « ${s(d.name)} » archivé`;
    case "product.compliance_confirmed": return `Vérifications de conformité confirmées pour « ${s(d.name)} »`;
    case "ad_campaign.deleted": return `Campagne publicitaire « ${s(d.name)} » supprimée`;
    case "ad_campaign.status": return `Campagne publicitaire « ${s(d.name)} » : ${s(d.from)} → ${s(d.to)}`;
    case "campaign.deleted": return `Campagne « ${s(d.title) || "sans titre"} » supprimée`;
    default: return e.action;
  }
}
