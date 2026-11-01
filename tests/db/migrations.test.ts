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
  await db.exec(`
    grant usage on schema public to authenticated;
    grant select, insert, update, delete on all tables in schema public to authenticated;
    insert into auth.users (id, email) values ('${A}', 'a@test.fr'), ('${B}', 'b@test.fr');`);
  bizA = (await one<{ id: string }>(`insert into businesses (owner_id, name) values ('${A}', 'A') returning id`)).id;
  bizB = (await one<{ id: string }>(`insert into businesses (owner_id, name) values ('${B}', 'B') returning id`)).id;
});

test("profil et abonnement gratuit créés à l'inscription", async () => {
  const r = await one<{ p: number; s: number }>(`select (select count(*)::int from profiles) p, (select count(*)::int from subscriptions where plan = 'free') s`);
  assert.deepEqual(r, { p: 2, s: 2 });
});

test("un commerçant ne voit ni ne modifie les données d'un autre", async () => {
  assert.deepEqual(await as(A, "select name from businesses"), [{ name: "A" }]);
  const pirate = await as(A, `insert into businesses (owner_id, name) values ('${B}', 'Pirate')`);
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
