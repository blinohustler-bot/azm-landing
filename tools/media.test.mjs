/* Banc d'essai de la carte produit : tags et association produit → vidéo.
 *
 *   node --conditions=react-server --import ./tools/alias-hook.mjs tools/media.test.mjs
 *   (inclus dans npm test)
 *
 * Aucune requête réseau. On teste le fichier de production (lib/cardMedia.ts) et la
 * vraie table d'association (build-videos.mjs) contre le vrai videos.json.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cardTags, MAX_TAGS, embedUrl } from '@/lib/cardMedia';
import { associate, cleanTitle, partsIn, RULES } from '../build-videos.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0; const fails = [];
const check = (n, c, d = '') => { if (c) { pass++; console.log(`  ok    ${n}`); } else { fails.push(n); console.log(`  ECHEC ${n}\n          ${d}`); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ── tags ─────────────────────────────────────────────────────────────────── */
console.log('\n=== TAGS ===');
const base = { bestSeller: false, proof: null, part: 'downpipe', selected: [], price: 500, freeShipMin: 1000 };
const t = (o) => cardTags({ ...base, ...o });

check('Race (catless) → Max power', eq(t({ selected: ['Race (Catless)', 'No'] }), ['Max power']));
check('High Flow (catted) → Daily friendly', eq(t({ selected: ['High Flow (Catted)', 'No'] }), ['Daily friendly']));
check('changer la variante change le tag',
  !eq(t({ selected: ['Race (Catless)'] }), t({ selected: ['High Flow (Catted)'] })));
check('échappement à valves → Daily friendly',
  eq(t({ part: 'exhaust-system', selected: ['Stainless Steel', 'OEM Valves'] }), ['Daily friendly']));
check('échappement Straight-Pipe (Race) → pas Daily friendly',
  eq(t({ part: 'exhaust-system', selected: ['Straight-Pipe (Race)', 'Stainless Steel'] }), []));
check('échappement Valved (Street/Track) → Daily friendly',
  eq(t({ part: 'exhaust-system', selected: ['Valved (Street/Track)', 'Grade 5 Titanium'] }), ['Daily friendly']));
check('« valve » hors échappement ne compte pas', eq(t({ part: 'downpipe', selected: ['Valve'] }), []));
check('Ships free à 1 000 $ pile', eq(t({ price: 1000 }), ['Ships free']));
check('pas de Ships free à 999 $', eq(t({ price: 999 }), []));
check('Top rated : 4.9 sur 3 avis', t({ proof: { rating: 4.9, count: 3, quote: null } }).includes('Top rated'));
check('pas Top rated : 5.0 sur 2 avis', !t({ proof: { rating: 5, count: 2, quote: null } }).includes('Top rated'));
check('pas Top rated : 4.8 sur 20 avis', !t({ proof: { rating: 4.8, count: 20, quote: null } }).includes('Top rated'));
check('priorité : Best seller > Top rated > Max power > Ships free, coupé à 2',
  eq(t({ bestSeller: true, proof: { rating: 5, count: 9, quote: null }, selected: ['Race (Catless)'], price: 4000 }),
    ['Best seller', 'Top rated']));
check('priorité : Max power avant Ships free',
  eq(t({ selected: ['Race (Catless)'], price: 4000 }), ['Max power', 'Ships free']));
let worst = 0;
for (const bs of [true, false]) for (const r of [null, { rating: 5, count: 9, quote: null }])
  for (const s of [['Race (Catless)'], ['High Flow (Catted)'], ['OEM Valves'], []])
    for (const part of ['downpipe', 'exhaust-system']) for (const price of [10, 5000])
      worst = Math.max(worst, t({ bestSeller: bs, proof: r, selected: s, part, price }).length);
check(`jamais plus de ${MAX_TAGS} tags (toutes combinaisons)`, worst <= MAX_TAGS, `max ${worst}`);

/* ── vidéo ────────────────────────────────────────────────────────────────── */
console.log('\n=== VIDEO ===');
const url = embedUrl('abc_123');
check('nocookie + playsinline + rel=0', url.startsWith('https://www.youtube-nocookie.com/embed/abc_123?')
  && url.includes('playsinline=1') && url.includes('rel=0'), url);

check('hashtags ignorés', cleanTitle('BMW M240i Catless #m340i') === 'bmw m240i catless');
check('pièce d’origine ignorée', eq(partsIn(cleanTitle('RS6 C8 Full titanium exhaust with original downpipes')), ['exhaust-system']));

const catalog = JSON.parse(readFileSync(resolve(ROOT, 'catalog.json'), 'utf8'));
const byHandle = Object.fromEntries(Object.values(catalog.products).map((p) => [p.handle, p]));
const modelsOf = {};
for (const mk of catalog.makes) for (const m of mk.models) for (const id of m.products) {
  const h = catalog.products[String(id)]?.handle;
  if (h) (modelsOf[h] ||= new Set()).add(m.key);
}

const shipped = JSON.parse(readFileSync(resolve(ROOT, 'videos.json'), 'utf8'));
const entries = Object.entries(shipped.products);
check('videos.json non vide', entries.length > 20, `${entries.length} fiches`);

let partOk = true, modelOk = true, ruled = true; const bad = [];
for (const [h, list] of entries) {
  if (!RULES[h]) { ruled = false; bad.push(`${h} sans règle`); }
  for (const v of list) {
    if (!partsIn(cleanTitle(v.title)).includes(byHandle[h]?.part)) { partOk = false; bad.push(`${h} ← ${v.title}`); }
    for (const m of v.models) if (!modelsOf[h]?.has(m)) { modelOk = false; bad.push(`${h} : modèle ${m} absent de la fiche`); }
  }
}
check('chaque vidéo montre le type de pièce de sa fiche', partOk, bad.join('\n          '));
check('chaque modèle visé est bien servi par la fiche', modelOk, bad.join('\n          '));
check('aucune fiche hors table RULES', ruled, bad.join('\n          '));

/* Les pièges connus, un par un. */
const ids = (h) => (shipped.products[h] ?? []).map((v) => v.id);
const forModel = (h, m) => (shipped.products[h] ?? []).find((v) => v.models.includes(m))?.id;
check('M3 voit une G80, M4 une G82',
  /g80/i.test(shipped.products['azm-g80-m3-g2-m4-3-0t-downpipe-catless-2021'].find((v) => v.models.includes('m3')).title)
  && /g82/i.test(shipped.products['azm-g80-m3-g2-m4-3-0t-downpipe-catless-2021'].find((v) => v.models.includes('m4')).title));
check('RS3 8V/TTRS : aucune vidéo (« RS3 » sans génération)', !ids('azm-audi-rs3-ttrs-downpipe').length);
check('RS3 « V5 » sans génération exclue de la 8Y', !ids('azm-audi-rs3-8y-downpipe').includes('jGe2gTWTrGc'));
check('Corvette C8 : aucune vidéo (#stingray et #z06 sur la même)',
  !ids('azm-chevrolet-corvette-c8-stingray-e-ray-2020-2025-downpipes').length
  && !ids('azm-chevrolet-corvette-c8-z06-2023-2025-front-pipes-downpipes-catless-high-flow-catted').length);
check('GT3 à valves : aucune vidéo (F1 ou pas, on ne sait pas)', !ids('porsche-gt3-gt3-rs-992-race-exhaust-system').length);
check('911 Turbo S 992 : aucune vidéo (trois pièces + high flow, trop loin de chaque fiche)',
  ['azm-porsche-turbo-s-992-downpipe', 'azm-porsche-turbo-s-992-titanium-valved-exhaust',
    'azm-porsche-911-turbo-turbo-s-992-racing-headers'].every((h) => !ids(h).length));
check('montage SF90 1300 hp jamais associé (promet plus que la pièce)',
  !entries.some(([, l]) => l.some((v) => v.id === 'nv-aj2ZFsAg' || /\b1300 ?hp\b/i.test(v.title))));
const all = entries.flatMap(([h, l]) => l.map((v) => ({ h, ...v })));
check('toute combinaison porte sa mention « Build also runs the AZM … »',
  all.every((v) => (v.combo ? /^Build also runs the AZM (downpipes|exhaust|headers)( and (downpipes|exhaust|headers))?$/.test(v.also) : v.also === null)),
  all.filter((v) => v.combo !== Boolean(v.also)).map((v) => v.h).join(', '));
check('jamais deux vidéos pour le même modèle d’une fiche (donnée morte)',
  entries.every(([, l]) => { const seen = l.flatMap((v) => v.models); return new Set(seen).size === seen.length; }));
check('Aventador S/SV : pas de vidéo SVJ', !(shipped.products['azm-lamborghini-aventador-s-sv-downpipes'] ?? []).some((v) => /svj/i.test(v.title)));
check('GT63S : pas d’E Performance', !(shipped.products['azm-mercedes-gt63-gt63s-performance-downpipes'] ?? []).some((v) => /gt63 ?se|perfomance/i.test(v.title)));
check('M240i F22 (gen 1) jamais sur la fiche GEN2', !ids('b58-downpipe-catless-for-2019-bmw-m340i-m440i-m240i-x5-40i-xdrive-g20-g22-g26-g05').includes('VvAwHfSZhzE'));
check('RSQ8 : la vidéo SQ8 n’est pas montrée à une RSQ8', forModel('3818-azm-rsq8-sq8-downpipe-catless-2018', 'rsq8') === undefined);
check('aucune vidéo avec admissions ou Z-pipe',
  !entries.some(([, l]) => l.some((v) => /intake|z ?pipe/i.test(v.title))));

/* videos.json doit être ce que produit la table actuelle : sinon quelqu'un a modifié
   la table sans régénérer, ou l'inverse. */
const SRC = 'C:/Users/Admin/Documents/azm-tyler/knowledge/videos.json';
if (existsSync(SRC)) {
  const again = associate(JSON.parse(readFileSync(SRC, 'utf8'))).products;
  check('videos.json à jour avec RULES', eq(again, shipped.products), 'relancer node build-videos.mjs');
} else {
  console.log('  --    inventaire de Tyler absent : vérification de fraîcheur sautée');
}

console.log(`\n=== BILAN ===\n  ${pass} passees, ${fails.length} echecs`);
process.exit(fails.length ? 1 : 0);
