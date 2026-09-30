#!/usr/bin/env node
// AZM — récolte les avis clients depuis les fiches produit Shopify.
// Sortie : reviews.json — note et avis par handle, prêt à être lu par lib/reviews.ts.
//
//   node build-reviews.mjs
//
// POURQUOI SCRAPER LA FICHE PLUTÔT QU'UNE API
// products.json (la source de catalog.json) ne porte aucune note : Shopify ne stocke
// pas les avis, c'est une app tierce qui les tient. Le magasin en a deux, et elles ne
// disent pas la même chose :
//
//   · Reputon Google Reviews — les avis Google du commerce. Note globale uniquement,
//     aucune notion de produit : un avis Google porte sur l'entreprise, jamais sur une
//     pièce. Ce chiffre-là vit dans lib/config.ts, à la main.
//   · Avada Air Reviews — les avis déposés sur le magasin, eux rattachés à un produit.
//     C'est ce que ce script récolte.
//
// Air Reviews imprime ses dix premiers avis dans le HTML de la fiche, côté serveur,
// plus un bloc aggregateRating. Les deux se lisent sans clé et sans exécuter de JS.
// Le reste de l'app charge le solde par XHR — d'où le plafond de dix avis par fiche,
// qui est largement au-dessus de ce que la landing affiche.
//
// LE MAGASIN LIMITE LE DÉBIT. Six requêtes en parallèle ramènent 61 réponses 429 sur
// 121 fiches (constaté le 2026-09-27). D'où le séquentiel et la reprise ci-dessous :
// c'est lent (~3 min) et ça n'a pas à être rapide, le fichier est régénéré à la main.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOP = 'https://azmotorsport.ca';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Découpe un littéral JSON équilibré à partir de sa première accolade. Une regex ne
   suffit pas : le contenu d'un avis peut contenir des accolades et des guillemets
   échappés. On compte donc les délimiteurs en ignorant ce qui est dans une chaîne. */
function sliceJson(src, from) {
  let depth = 0, inStr = false, esc = false;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') { depth--; if (depth === 0) return src.slice(from, i + 1); }
  }
  return null;
}

/* « Jean Pierre » + « Tremblay » → « Jean Pierre T. » — le format déjà choisi dans
   l'app du magasin (formatCustomerName: initial_last_name_dot). On l'imite pour que
   la landing et la fiche Shopify ne nomment pas la même personne différemment. */
function displayName(first, last) {
  const f = String(first || '').trim();
  const l = String(last || '').trim();
  if (!f) return 'Customer';
  return l ? `${f} ${l[0].toUpperCase()}.` : f;
}

/* La première photo jointe, ou ''. On ne garde que les URL Firebase Storage de l'app :
   ce sont les seules à être servies publiquement et à durer, et next.config.ts n'a
   déclaré que cet hôte-là dans remotePatterns — une URL venue d'ailleurs ferait une
   image morte en production plutôt qu'une erreur de build. */
function firstImage(images) {
  if (!Array.isArray(images)) return '';
  const url = images.find((u) => typeof u === 'string'
    && u.startsWith('https://firebasestorage.googleapis.com/'));
  return url ? url.replace(/&amp;/g, '&') : '';
}

function parsePage(html) {
  const out = { rating: null, count: 0, reviews: [] };

  const agg = html.match(/"aggregateRating"\s*:\s*\{([\s\S]{0,300}?)\}/);
  if (agg) {
    const rv = agg[1].match(/"ratingValue"\s*:\s*([0-9.]+)/);
    const rc = agg[1].match(/"reviewCount"\s*:\s*([0-9]+)/);
    out.rating = rv ? Number(rv[1]) : null;
    out.count = rc ? Number(rc[1]) : 0;
  }

  const at = html.search(/"reviews"\s*:\s*\[/);
  if (at > -1) {
    const txt = sliceJson(html, html.indexOf('[', at));
    let arr = null;
    try { arr = JSON.parse(txt); } catch { /* bloc tronqué : on garde juste l'agrégat */ }
    if (Array.isArray(arr)) {
      const mapped = arr
        .filter((r) => r && r.status !== 'disapproved' && Number(r.rate) > 0)
        .map((r) => ({
          name: displayName(r.firstName ?? r.first_name, r.lastName ?? r.last_name),
          rate: Number(r.rate),
          text: String(r.content || '').replace(/\s+/g, ' ').trim(),
          date: String(r.createdAt || '').slice(0, 10),
          country: r.countryCode || '',
          verified: Boolean(r.verified),
          /* La photo que le client a jointe — son char, pas un visuel de catalogue.
             Sur cette clientèle c'est la preuve la plus forte qu'on ait, et les 20
             avis de l'échantillon en portent tous une. On n'en garde qu'une : la
             tuile n'a de place que pour ça, et une galerie par avis ferait du poids
             pour rien sur une page payée à l'impression.
             Les URL Firebase arrivent avec leurs entités HTML échappées par Liquid. */
          image: firstImage(r.images)
        }));

      /* Garde-fou contre le même avis publié deux fois sur UNE fiche. Sur les données
         du 2026-09-27 il n'enlève rien — les doublons réels d'AZM sont d'une fiche à
         l'autre, quand le client a pris les downpipes ET l'échappement, et ce
         script-là travaille fiche par fiche. Ce cas-là se règle dans lib/reviews.ts,
         qui voit le fichier entier.
         *
         * Lequel garder quand ça arrive : celui qui CRIE le moins, même règle qu'en
         * aval. Choisir entre deux envois réels de la même personne est légitime ;
         * réécrire le texte d'un client ne le serait pas, et on ne le fait nulle part. */
      const shout = (s) => {
        const letters = s.replace(/[^A-Za-z]/g, '');
        if (letters.length < 12) return 0;
        return (letters.match(/[A-Z]/g) || []).length / letters.length;
      };
      const best = new Map();
      out.reviews = [];
      for (const r of mapped) {
        const key = r.text.toLowerCase().replace(/[^a-z0-9]+/g, '');
        if (!key) { out.reviews.push(r); continue; }   // un avis sans texte reste compté
        const seen = best.get(key);
        if (!seen) { best.set(key, r); out.reviews.push(r); continue; }
        if (shout(r.text) < shout(seen.text)) {
          out.reviews[out.reviews.indexOf(seen)] = r;
          best.set(key, r);
        }
      }
    }
  }

  return out;
}

async function fetchProduct(handle) {
  const url = `${SHOP}/products/${handle}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    let res;
    try {
      res = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'en-CA,en;q=0.9' } });
    } catch {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    if (res.status === 429 || res.status >= 500) { await sleep(2500 * (attempt + 1)); continue; }
    if (res.status === 404) return { gone: true };
    if (!res.ok) return { error: res.status };
    return parsePage(await res.text());
  }
  return { error: 429 };
}

/* ── récolte ─────────────────────────────────────────────────────────────── */

const catalog = JSON.parse(readFileSync(resolve(HERE, 'catalog.json'), 'utf8'));
const handles = [...new Set(Object.values(catalog.products).map((p) => p.handle))].filter(Boolean);

console.log(`${handles.length} fiches à interroger sur ${SHOP}`);

const products = {};
let gone = 0, failed = 0;

for (let i = 0; i < handles.length; i++) {
  const handle = handles[i];
  const got = await fetchProduct(handle);
  if (got.gone) gone++;
  else if (got.error) failed++;
  else if (got.count > 0 || got.reviews.length) {
    products[handle] = { rating: got.rating, count: got.count, reviews: got.reviews };
  }
  process.stdout.write(`\r  ${i + 1}/${handles.length} — ${Object.keys(products).length} fiches notées   `);
  await sleep(900);      // sous le seuil qui déclenche les 429
}
console.log();

const reviewed = Object.values(products);
const out = {
  generated: new Date().toISOString(),
  shop: SHOP,
  /* Ce que la landing peut honnêtement afficher, en un coup d'œil. */
  totals: {
    handles: handles.length,
    rated: reviewed.length,
    reviews: reviewed.reduce((s, p) => s + p.count, 0),
    quoted: reviewed.reduce((s, p) => s + p.reviews.length, 0)
  },
  products
};

writeFileSync(resolve(HERE, 'reviews.json'), JSON.stringify(out, null, 2) + '\n');

console.log(`reviews.json écrit — ${out.totals.rated}/${out.totals.handles} fiches notées, `
  + `${out.totals.reviews} avis, dont ${out.totals.quoted} citables.`);
if (gone) console.log(`  ${gone} fiche(s) 404 : le catalogue a dérivé du magasin, relancer build-index.mjs.`);
if (failed) console.log(`  ${failed} fiche(s) non jointes — relancer, le résultat est incomplet.`);
