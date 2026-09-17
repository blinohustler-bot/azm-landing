#!/usr/bin/env node
/* Vérifie la configuration GHL avant de brancher la campagne.
 *
 *   node tools/ghl-check.mjs
 *
 * Lit .env à la racine (ou l'environnement, qui gagne), puis :
 *   1. confirme que le jeton ouvre bien le sous-compte ;
 *   2. imprime les pipelines et leurs étapes, avec les ids à coller dans Vercel ;
 *   3. dit où une opportunité atterrirait avec la configuration actuelle.
 *
 * Aucune écriture dans GHL. Le jeton n'est jamais imprimé.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://services.leadconnectorhq.com';

/* Un .env local sert à cette vérification depuis le poste ; en production les mêmes
   noms vivent dans Vercel. Une variable déjà exportée l'emporte sur le fichier. */
function loadEnv() {
  let text;
  try { text = readFileSync(resolve(ROOT, '.env'), 'utf8'); } catch { return; }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim().replace(/^["']|["']$/g, '');
    if (val && process.env[key] === undefined) process.env[key] = val;
  }
}

function die(msg, hint) {
  console.error(`\n  ✗ ${msg}`);
  if (hint) console.error(`    ${hint}`);
  process.exit(1);
}

async function get(path, query) {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(query || {})) {
    if (v) url.searchParams.append(k, String(v));
  }
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.GHL_API_KEY}`,
      Version: process.env.GHL_API_VERSION || '2021-07-28',
      Accept: 'application/json'
    },
    signal: AbortSignal.timeout(15000)
  });
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch { /* laissé à null */ }
  if (!res.ok) {
    const msg = body && body.message;
    die(`${path} → HTTP ${res.status}`,
      Array.isArray(msg) ? msg.join('; ') : (msg || text.slice(0, 200)));
  }
  return body || {};
}

loadEnv();

const key = process.env.GHL_API_KEY;
const loc = process.env.GHL_LOCATION_ID;
if (!key) die('GHL_API_KEY absent.', 'Copier .env.example en .env et remplir le PIT du sous-compte.');
if (!loc) die('GHL_LOCATION_ID absent.', 'Visible dans app.gohighlevel.com/location/<CECI>/…');

console.log(`\n  Jeton      ${key.slice(0, 4)}…${key.slice(-4)}  (${key.length} caractères)`);
console.log(`  Location   ${loc}`);
console.log(`  Version    ${process.env.GHL_API_VERSION || '2021-07-28'}`);

/* 1 — le jeton ouvre-t-il bien ce sous-compte */
const probe = await get('/contacts/', { locationId: loc, limit: 1 });
const total = probe.meta && probe.meta.total;
console.log(`\n  ✓ Contacts lisibles${total != null ? ` — ${total} au total` : ''}`);

/* 2 — les pipelines, avec les ids */
const { pipelines = [] } = await get('/opportunities/pipelines', { locationId: loc });
if (!pipelines.length) die('Aucun pipeline dans ce sous-compte.', 'En créer un dans GHL > Opportunities.');

console.log(`\n  ✓ ${pipelines.length} pipeline(s) :\n`);
for (const p of pipelines) {
  console.log(`    ${p.name}`);
  console.log(`      GHL_PIPELINE_ID=${p.id}`);
  const stages = (p.stages || []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  for (const s of stages) console.log(`        ${String(s.name).padEnd(28)} GHL_STAGE_ID=${s.id}`);
  console.log('');
}

/* 3 — où le lead atterrirait, avec la configuration telle qu'elle est */
const lower = (v) => String(v || '').trim().toLowerCase();
let target;
if (process.env.GHL_PIPELINE_ID && process.env.GHL_STAGE_ID) {
  const p = pipelines.find((x) => x.id === process.env.GHL_PIPELINE_ID);
  const s = p && (p.stages || []).find((x) => x.id === process.env.GHL_STAGE_ID);
  if (!p) die('GHL_PIPELINE_ID ne correspond à aucun pipeline de ce sous-compte.');
  if (!s) die(`GHL_STAGE_ID ne correspond à aucune étape de "${p.name}".`);
  target = { how: 'par id', pipeline: p.name, stage: s.name };
} else {
  const wantP = lower(process.env.GHL_PIPELINE_NAME);
  const p = (wantP && pipelines.find((x) => lower(x.name) === wantP)) || pipelines[0];
  if (wantP && lower(p.name) !== wantP) die(`Pipeline "${process.env.GHL_PIPELINE_NAME}" introuvable.`);
  const stages = (p.stages || []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const wantS = lower(process.env.GHL_STAGE_NAME);
  const s = (wantS && stages.find((x) => lower(x.name) === wantS)) || stages[0];
  if (wantS && lower(s.name) !== wantS) die(`Étape "${process.env.GHL_STAGE_NAME}" introuvable dans "${p.name}".`);
  target = {
    how: wantP || wantS ? 'par nom' : 'par défaut (premier pipeline, première étape)',
    pipeline: p.name, stage: s.name
  };
}

console.log(`  → Un lead atterrirait dans  ${target.pipeline} / ${target.stage}   (${target.how})`);
if (target.how.startsWith('par défaut')) {
  console.log('\n  ⚠ Rien n\'est configuré : c\'est le premier pipeline qui gagne, et il bouge');
  console.log('    dès que quelqu\'un en réordonne un dans GHL. Poser GHL_PIPELINE_ID et');
  console.log('    GHL_STAGE_ID ci-dessus avant d\'ouvrir la campagne.');
}
console.log('');
