// Applique toutes les migrations sur un Postgres embarqué (PGlite) avec un auth/storage minimal,
// puis vérifie l'isolation des données (RLS) et la logique de quotas.
// Aucune connexion à la base de production.

import { before, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
const C = "33333333-3333-3333-3333-333333333333";
let bizA = "";
let bizB = "";

const STUBS = `
create role anon; create role authenticated; create role service_role;
create schema auth; create schema extensions;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true),''),'anon') $$;
create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name,'/') $$;
alter table storage.objects enable row level security;
-- Comme Supabase : les nouvelles tables du schéma public sont accessibles aux rôles API (la RLS filtre).
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
`;

async function as<T = Record<string, unknown>>(uid: string, sql: string): Promise<T[] | string> {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub','${uid}',false); select set_config('request.jwt.claim.role','authenticated',false); set role authenticated;`);
  try {
    return (await db.query<T>(sql)).rows;
  } catch (e) {
    return `ERREUR: ${(e as Error).message}`;
  } finally {
    await db.exec("reset role");
  }
}
const one = async <T>(sql: string) => (await db.query<T>(sql)).rows[0];

before(async () => {
  await db.exec(STUBS);
  const dir = path.join(process.cwd(), "supabase/migrations");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    try {
      await db.exec(fs.readFileSync(path.join(dir, f), "utf8"));
    } catch (e) {
      throw new Error(`Migration ${f} : ${(e as Error).message}`);
    }
  }
  await db.exec(`insert into auth.users (id, email) values ('${A}', 'a@test.fr'), ('${B}', 'b@test.fr'), ('${C}', 'c@test.fr');`);
  bizA = await createBusiness(A, "A");
  bizB = await createBusiness(B, "B");
});

/** Parcours de l'application : organisation créée par l'utilisateur, puis commerce dans cette organisation. */
async function createBusiness(uid: string, name: string) {
  const org = await as<{ id: string }>(uid, `select create_organization('${name}') id`);
  assert.ok(Array.isArray(org), String(org));
  const biz = await as<{ id: string }>(uid, `insert into businesses (owner_id, organization_id, name) values ('${uid}', '${org[0].id}', '${name}') returning id`);
  assert.ok(Array.isArray(biz), String(biz));
  return biz[0].id;
}

test("profil et abonnement gratuit créés à l'inscription", async () => {
  const r = await one<{ p: number; s: number }>(`select (select count(*)::int from profiles) p, (select count(*)::int from subscriptions where plan = 'free') s`);
  assert.deepEqual(r, { p: 3, s: 3 });
});

test("un commerçant ne voit ni ne modifie les données d'un autre", async () => {
  assert.deepEqual(await as(A, "select name from businesses"), [{ name: "A" }]);
  const orgB = (await one<{ organization_id: string }>(`select organization_id from businesses where id = '${bizB}'`)).organization_id;
  const pirate = await as(A, `insert into businesses (owner_id, organization_id, name) values ('${A}', '${orgB}', 'Pirate')`);
  assert.match(String(pirate), /ERREUR/);

  await db.exec(`insert into products (business_id, category_id, name, price_cents) values ('${bizB}', 'mode', 'Robe B', 4900)`);
  assert.deepEqual(await as(A, "select name from products"), []);
  const steal = await as(A, `insert into products (business_id, category_id, name, price_cents) values ('${bizB}', 'mode', 'x', 1)`);
  assert.match(String(steal), /ERREUR/);
  await as(A, "update products set price_cents = 1");
  assert.equal((await one<{ price_cents: number }>("select price_cents from products where name = 'Robe B'")).price_cents, 4900);
});

test("l'abonnement n'est pas modifiable par l'utilisateur", async () => {
  await as(A, "update subscriptions set plan = 'business'");
  assert.equal((await one<{ plan: string }>(`select plan from subscriptions where user_id = '${A}'`)).plan, "free");
});

test("catalogue : contraintes de cohérence", async () => {
  const bad = [
    `insert into products (business_id, category_id, name, price_cents, compare_at_cents) values ('${bizA}', 'mode', 'x', 1000, 900)`,
    `insert into products (business_id, category_id, name, price_cents, attributes) values ('${bizA}', 'mode', 'x', 1, '[]')`,
    `insert into products (business_id, category_id, name, price_cents) values ('${bizA}', 'inconnue', 'x', 1)`,
  ];
  for (const sql of bad) await assert.rejects(db.query(sql));
  assert.equal((await one<{ n: number }>("select count(*)::int n from product_categories")).n, 26);
});

test("quotas : plafond, doublon, remboursement, commerce d'autrui", async () => {
  const consume = async (key: string, biz = bizA) =>
    (await one<{ r: { ok: boolean; reason?: string } }>(`select consume_generation('${A}', '${biz}', 'generate_product', '${key}') r`)).r;
  assert.equal((await consume("k1")).ok, true);
  assert.equal((await consume("k1")).reason, "duplicate", "même demande envoyée deux fois");
  for (let i = 2; i <= 3; i++) assert.equal((await consume(`k${i}`)).ok, true);
  assert.equal((await consume("k4")).reason, "quota", "offre gratuite : 3 générations");
  await db.exec(`select refund_generation('${A}', 'k3')`);
  assert.equal((await consume("k5")).ok, true, "crédit rendu après échec");
  assert.equal((await consume("k6", bizB)).reason, "business");
});

test("les fonctions de quota ne sont pas appelables par un utilisateur", async () => {
  const r = await as(A, `select consume_generation('${A}', '${bizA}', 'generate_post', 'x')`);
  assert.match(String(r), /ERREUR/);
});

// ---------------------------------------------------------------------------
// Organisations, équipe et rôles
// ---------------------------------------------------------------------------
const orgOf = async (biz: string) => (await one<{ o: string }>(`select organization_id o from businesses where id = '${biz}'`)).o;
const HASH = (c: string) => c.repeat(64);

test("offre gratuite : 1 commerce et 1 membre par organisation", async () => {
  const org = await orgOf(bizA);
  const second = await as(A, `insert into businesses (owner_id, organization_id, name) values ('${A}', '${org}', 'A2')`);
  assert.match(String(second), /business_limit/);
  const inv = await as(A, `select invite_member('${org}', 'c@test.fr', 'member', '${HASH("a")}')`);
  assert.match(String(inv), /member_limit/);
});

test("invitation : seul l'e-mail invité peut l'accepter, une seule fois", async () => {
  const org = await orgOf(bizA);
  await db.exec(`update subscriptions set plan = 'pro', status = 'active' where user_id = '${A}'`);
  assert.ok(Array.isArray(await as(A, `select invite_member('${org}', 'C@Test.fr', 'member', '${HASH("b")}')`)));
  const preview = (await as<{ p: { status: string; email_matches: boolean; email_hint: string } }>(B, `select invitation_preview('${HASH("b")}') p`)) as { p: { status: string; email_matches: boolean; email_hint: string } }[];
  assert.deepEqual([preview[0].p.status, preview[0].p.email_matches, preview[0].p.email_hint], ["pending", false, "c***@test.fr"]);
  assert.match(String(await as(B, `select accept_invitation('${HASH("b")}')`)), /invitation_email/);
  assert.match(String(await as(C, `select accept_invitation('${HASH("z")}')`)), /invitation_invalid/);
  assert.ok(Array.isArray(await as(C, `select accept_invitation('${HASH("b")}')`)));
  assert.match(String(await as(C, `select accept_invitation('${HASH("b")}')`)), /invitation_used/);
  // Le jeton n'est jamais lisible.
  assert.match(String(await as(A, "select token_hash from organization_invitations")), /ERREUR/);
});

test("rôle employé : accès au contenu, pas aux réglages ni à l'équipe", async () => {
  const org = await orgOf(bizA);
  assert.deepEqual(await as(C, "select name from businesses"), [{ name: "A" }]);
  const product = await as(C, `insert into products (business_id, category_id, name, price_cents) values ('${bizA}', 'mode', 'Produit employé', 100) returning name`);
  assert.deepEqual(product, [{ name: "Produit employé" }]);
  await as(C, `update businesses set name = 'Piraté' where id = '${bizA}'`);
  assert.equal((await one<{ name: string }>(`select name from businesses where id = '${bizA}'`)).name, "A");
  assert.match(String(await as(C, `select invite_member('${org}', 'x@test.fr', 'member', '${HASH("c")}')`)), /forbidden/);
  assert.match(String(await as(C, `insert into organization_members (organization_id, user_id, role) values ('${org}', '${C}', 'owner')`)), /ERREUR/);
  assert.match(String(await as(C, `select remove_member('${org}', '${A}')`)), /forbidden/);
  assert.equal((await as<{ email: string }>(C, `select email from org_members('${org}')`) as { email: string }[]).length, 2);
  assert.deepEqual(await as(B, `select email from org_members('${org}')`), [], "un tiers ne voit pas l'équipe");
});

test("rôles : le propriétaire promeut, l'admin gère les commerces, le dernier propriétaire ne part pas", async () => {
  const org = await orgOf(bizA);
  assert.ok(Array.isArray(await as(A, `select update_member_role('${org}', '${C}', 'admin')`)));
  const biz = await as<{ name: string }>(C, `insert into businesses (owner_id, organization_id, name) values ('${C}', '${org}', 'A2 par admin') returning name`);
  assert.deepEqual(biz, [{ name: "A2 par admin" }], "offre Pro : 3 commerces");
  assert.match(String(await as(C, `select update_member_role('${org}', '${A}', 'member')`)), /forbidden/);
  assert.match(String(await as(A, `select remove_member('${org}', '${A}')`)), /last_owner/);
  assert.match(String(await as(C, `delete from businesses where name = 'A2 par admin' returning id`)), /^$|\[\]/);
});

test("quota partagé par toute l'organisation", async () => {
  const org = await orgOf(bizA);
  const q = (await as<{ r: { plan: string; quota: number; used: number } }>(C, `select org_quota('${bizA}') r`)) as { r: { plan: string; quota: number; used: number } }[];
  assert.equal(q[0].r.plan, "pro");
  const used = q[0].r.used;
  const r = (await one<{ r: { ok: boolean; used: number } }>(`select consume_generation('${C}', '${bizA}', 'generate_post', 'emp-1') r`)).r;
  assert.equal(r.ok, true);
  assert.equal(r.used, used + 1, "la génération de l'employé compte pour l'organisation");
  assert.equal((await one<{ r: { reason: string } }>(`select consume_generation('${B}', '${bizA}', 'generate_post', 'x-1') r`)).r.reason, "business");
  assert.equal(await as(B, `select org_quota('${bizA}') r`).then((x) => (x as { r: unknown }[])[0].r), null);
  void org;
});

test("départ d'un membre : accès retiré immédiatement", async () => {
  const org = await orgOf(bizA);
  assert.ok(Array.isArray(await as(C, `select remove_member('${org}', '${C}')`)));
  assert.deepEqual(await as(C, "select name from businesses"), []);
  assert.deepEqual(await as(C, "select name from products"), []);
});

// ---------------------------------------------------------------------------
// Journal d'audit et limites de débit
// ---------------------------------------------------------------------------
test("journal d'audit : actions d'équipe et de commerce tracées, lecture réservée", async () => {
  const org = await orgOf(bizA);
  await as(A, `update businesses set city = 'Paris' where id = '${bizA}'`);
  await as(A, `update businesses set name = 'A' where id = '${bizA}'`); // aucun changement : pas d'entrée
  const rows = (await as<{ action: string; actor_id: string; details: Record<string, unknown> }>(A, `select action, actor_id, details from audit_log where organization_id = '${org}' order by id`)) as {
    action: string; actor_id: string; details: Record<string, unknown>;
  }[];
  const actions = rows.map((r) => r.action);
  for (const a of ["member.added", "business.created", "invitation.created", "invitation.accepted", "member.role_changed", "member.left", "business.updated"])
    assert.ok(actions.includes(a), `${a} absent de ${actions.join(", ")}`);
  assert.equal(actions.filter((a) => a === "business.updated").length, 1);
  assert.deepEqual(rows.find((r) => r.action === "business.updated")!.details, { fields: ["city"] }, "noms des champs seulement");
  assert.equal(rows.find((r) => r.action === "business.updated")!.actor_id, A);
  assert.deepEqual(await as(B, `select action from audit_log where organization_id = '${org}'`), [], "un tiers ne lit rien");
  assert.match(String(await as(A, `insert into audit_log (organization_id, action, target_type) values ('${org}', 'faux', 'x')`)), /ERREUR/);
  assert.match(String(await as(A, "delete from audit_log")), /ERREUR/, "journal non effaçable");
});

test("limites de débit : par utilisateur, sans effet sur les autres", async () => {
  const hit = async (uid: string) => ((await as<{ ok: boolean }>(uid, "select rate_limit_hit('test', 3, 60) ok")) as { ok: boolean }[])[0].ok;
  assert.deepEqual([await hit(A), await hit(A), await hit(A), await hit(A)], [true, true, true, false]);
  assert.equal(await hit(B), true);
  assert.match(String(await as(A, "select * from rate_limits")), /ERREUR/);
});
