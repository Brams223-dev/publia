import type { Metadata } from "next";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { ROLE_LABELS, canManage, getCurrentBusiness } from "@/lib/business";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SECTORS } from "@/lib/config/business";
import { formatInstant } from "@/lib/format";
import { TeamPanel, type Member, type Invitation } from "./team-panel";
import { BusinessesPanel, OrgNameForm } from "./org-forms";
import { ActivityLog, type AuditEntry } from "./activity-log";

export const metadata: Metadata = { title: "Organisation et équipe" };

export default async function OrganisationPage() {
  if (!isSupabaseConfigured()) return null;
  const { supabase, user, business, role, businesses } = await getCurrentBusiness();
  if (!user) return null;
  if (!business || !role)
    return (
      <div className="mt-4 card p-6">
        <p className="font-semibold">Créez d&apos;abord votre commerce</p>
        <p className="mt-1 text-sm text-ink-soft">Votre organisation est créée avec votre premier commerce. Vous pourrez ensuite inviter votre équipe.</p>
        <Link href="/mon-commerce" className="btn-primary mt-4">Créer mon commerce</Link>
      </div>
    );

  const org = business.organization_id;
  const manage = canManage(role);
  const [{ data: orgRow }, { data: members }, { data: invites }, { data: limits }, { data: plan }, { data: audit }] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", org).single(),
    supabase.rpc("org_members", { p_org: org }),
    manage
      ? supabase.from("organization_invitations").select("id, email, role, expires_at, created_at").eq("organization_id", org).is("accepted_at", null).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase.from("plan_limits").select("plan, name, max_businesses, max_members"),
    supabase.rpc("org_plan", { org }),
    manage
      ? supabase.from("audit_log").select("id, created_at, actor_id, action, details").eq("organization_id", org).order("id", { ascending: false }).limit(50)
      : Promise.resolve({ data: [] }),
  ]);
  const emails = new Map(((members ?? []) as Member[]).map((m) => [m.user_id, m.full_name || m.email]));
  const entries: AuditEntry[] = (audit ?? []).map((a) => ({
    id: a.id,
    created_at: a.created_at,
    when: formatInstant(a.created_at, "full"),
    actor: a.actor_id ? (a.actor_id === user.id ? "vous" : (emails.get(a.actor_id) ?? "ancien membre")) : "Publia",
    action: a.action,
    details: (a.details ?? {}) as Record<string, unknown>,
  }));
  const limit = limits?.find((l) => l.plan === (plan ?? "free")) ?? limits?.find((l) => l.plan === "free");
  const orgBusinesses = businesses.filter((b) => b.organization_id === org);
  const pending = (invites ?? []).filter((i) => new Date(i.expires_at) > new Date());
  const seats = (members?.length ?? 0) + pending.length;

  return (
    <div className="mt-4 space-y-6">
      <header className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand text-white"><Building2 className="size-6" /></span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold sm:text-3xl">{orgRow?.name ?? "Organisation"}</h1>
          <p className="mt-1 text-ink-soft">
            Vos commerces et votre équipe. Votre rôle : <span className="font-medium text-ink">{ROLE_LABELS[role]}</span> · offre{" "}
            {limit?.name ?? "Free"}
          </p>
        </div>
      </header>

      {manage ? <OrgNameForm name={orgRow?.name ?? ""} /> : null}

      <BusinessesPanel
        organizationId={org}
        currentId={business.id}
        businesses={orgBusinesses.map((b) => ({ id: b.id, name: b.name }))}
        canAdd={manage}
        max={limit?.max_businesses ?? 1}
        sectors={[...SECTORS]}
      />

      <TeamPanel
        meId={user.id}
        myRole={role}
        members={((members ?? []) as Member[]).map((m) => ({ ...m, joined: formatInstant(new Date(m.joined_at), "dayMonthYear") }))}
        invitations={pending.map((i) => ({ ...i, expires: formatInstant(new Date(i.expires_at), "dayMonthYear") })) as Invitation[]}
        seats={seats}
        maxSeats={limit?.max_members ?? 1}
      />

      {manage ? <ActivityLog entries={entries} /> : null}

      {businesses.some((b) => b.organization_id !== org) ? (
        <p className="text-sm text-ink-soft">
          Vous faites aussi partie d&apos;autres organisations : changez de commerce depuis le sélecteur du menu pour les gérer.
        </p>
      ) : null}
    </div>
  );
}
