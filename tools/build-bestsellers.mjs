#!/usr/bin/env node
// AZM — calcule les « Best seller » de la landing à partir des vraies ventes.
// Sortie : bestsellers.json à la racine, lu par lib/bestsellers.ts.
//
//   SHOPIFY_STORE=azmotorsport.myshopify.com SHOPIFY_ADMIN_TOKEN=shpat_… \
//     node tools/build-bestsellers.mjs
//
// À LANCER À LA MAIN, HORS LIGNE. Le jeton Admin ne doit jamais être sur Vercel ni
// dans le dépôt : il ouvre les commandes et les clients de la boutique. Le script lit
// seulement (scope read_orders, plus read_all_orders — sans lui Shopify ne rend que
// les 60 derniers jours, et la fenêtre est de 90).
//
// CE QU'IL COMPTE
// Les quantités vendues par handle de produit sur les 90 derniers jours, commandes
// annulées et commandes de test exclues. Puis, pour CHAQUE écran de résultats de la
// landing (marque | modèle | génération, comme lib/catalog.ts les construit), la pièce
// la plus vendue parmi celles que l'écran affiche.
//
// QUAND IL NE DIT RIEN, ET POURQUOI
// « Best seller » est une affirmation. Elle n'est écrite que si elle est vraie sans
// discussion :
//   - l'écran montre au moins deux pièces (seule, une pièce est « la plus vendue »
//     par construction, ce qui ne veut rien dire) ;
//   - la première a au moins MIN_UNITS ventes sur la période ;
//   - elle devance strictement la deuxième (une égalité n'a pas de gagnant).

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DAYS = 90;
const MIN_UNITS = 3;
const API = '2025-01';

const store = process.env.SHOPIFY_STORE;
const token = process.env.SHOPIFY_ADMIN_TOKEN;
if (!store || !token) {
  console.error('SHOPIFY_STORE et SHOPIFY_ADMIN_TOKEN sont requis (voir l’en-tête du script).');
  process.exit(1);
}

const since = new Date(Date.now() - DAYS * 864e5).toISOString().slice(0, 10);

const QUERY = `query Orders($cursor: String, $q: String!) {
  orders(first: 100, after: $cursor, query: $q, sortKey: CREATED_AT) {
    pageInfo { hasNextPage endCursor }
    nodes {
      cancelledAt
      test
      lineItems(first: 100) { nodes { quantity product { handle } } }
    }
  }
}`;

async function gql(variables) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`https://${store}/admin/api/${API}/graphql.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
      body: JSON.stringify({ query: QUERY, variables })
    });
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 2000 * (attempt + 1))); continue; }
    const json = await res.json();
    if (!res.ok || json.errors) throw new Error(`Shopify ${res.status} : ${JSON.stringify(json.errors ?? json)}`);
    return json.data;
  }
  throw new Error('Shopify limite le débit : réessayer plus tard.');
}

/* ── les ventes ──────────────────────────────────────────────────────────── */

const sold = new Map();
let orders = 0;
let cursor = null;
do {
  const data = await gql({ cursor, q: `created_at:>=${since}` });
  for (const o of data.orders.nodes) {
    if (o.cancelledAt || o.test) continue;
    orders++;
    for (const li of o.lineItems.nodes) {
      const h = li.product?.handle;
      if (h) sold.set(h, (sold.get(h) ?? 0) + li.quantity);
    }
  }
  cursor = data.orders.pageInfo.hasNextPage ? data.orders.pageInfo.endCursor : null;
} while (cursor);

/* ── les écrans de la landing ────────────────────────────────────────────── */

/* Même découpage que app/page.tsx : un écran par génération quand le modèle en a
   plusieurs, sinon un écran pour le modèle. */
const catalog = JSON.parse(readFileSync(resolve(ROOT, 'catalog.json'), 'utf8'));
const handleOf = (id) => catalog.products[String(id)]?.handle;
const screens = {};
const lines = [];

for (const make of catalog.makes) {
  for (const model of make.models) {
    const sets = model.generations.length > 1
      ? model.generations.map((g) => ({ from: g.from, ids: g.products }))
      : [{ from: null, ids: model.products }];
    for (const s of sets) {
      const ranked = s.ids.map(handleOf).filter(Boolean)
        .map((h) => ({ h, n: sold.get(h) ?? 0 }))
        .sort((a, b) => b.n - a.n);
      if (ranked.length < 2) continue;
      const [first, second] = ranked;
      if (first.n < MIN_UNITS || first.n <= second.n) continue;
      const key = `${make.make}|${model.key}|${s.from ?? ''}`;
      screens[key] = first.h;
      lines.push(`${key.padEnd(34)} ${first.h}  (${first.n} vs ${second.n})`);
    }
  }
}

writeFileSync(resolve(ROOT, 'bestsellers.json'), JSON.stringify({
  generated: new Date().toISOString(),
  days: DAYS,
  minUnits: MIN_UNITS,
  orders,
  screens
}, null, 2) + '\n');

console.log(lines.join('\n'));
console.log(`\n${orders} commandes depuis le ${since}, ${Object.keys(screens).length} écrans avec un best seller.`);
