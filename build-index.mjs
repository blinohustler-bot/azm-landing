#!/usr/bin/env node
// AZM — construit l'index de compatibilité (fitment) à partir du catalogue Shopify public.
// Source : https://azmotorsport.ca/products.json (aucun token requis, lecture seule).
// Sortie  : catalog.json — marques > modèles > années > produits, prêt pour la landing page.
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOP = 'https://azmotorsport.ca';

const MAKE_ALIAS = {
  'mercedes-benz': 'Mercedes-AMG', mercedes: 'Mercedes-AMG', bmw: 'BMW', audi: 'Audi',
  porsche: 'Porsche', ferrari: 'Ferrari', lamborghini: 'Lamborghini', mclaren: 'McLaren',
  chevrolet: 'Chevrolet', toyota: 'Toyota',
};

// Bruit à retirer d'un tag modèle : marques, codes moteur, millésimes, mentions de version.
const NOISE = 'corvette|chevrolet|bmw|audi|porsche|ferrari|lamborghini|mclaren|mercedes|benz|amg|toyota'
  + '|b58|s55|s58|s63|s68|n63r|n55|m177|m178|lci|facelift|full|f1|gen1|gen2|gen3|19\\d{2}|20\\d{2}';
const STRIP = new RegExp(`\\b(${NOISE})\\b`, 'gi');

const canon = (tag) => tag.toLowerCase()
  .replace(/\([^)]*\)/g, ' ')      // retire (G20/G22)
  .replace(/[-_/]/g, ' ')
  .replace(STRIP, ' ')
  .replace(/\s+/g, ' ')
  .trim();

// Casse propre : 340i · M240i · X5 · RS6 · GT3 · FF · C8 Z06
const caseWord = (w) => {
  if (w.length <= 5 && w === w.toUpperCase()) return w;           // TTRS, SVJ — déjà écrit en capitales
  if (/^\d+i$/.test(w)) return w.toLowerCase();                  // 340i, 540i
  if (/^m\d+i$/i.test(w)) return 'M' + w.slice(1).toLowerCase();  // M240i, M550i
  if (/^[xz]\d/i.test(w)) return w.toUpperCase();                 // X5, Z4
  if (/\d/.test(w) || w.length <= 3) return w.toUpperCase();      // RS6, GT3, FF, SV, GTS
  return w[0].toUpperCase() + w.slice(1).toLowerCase();           // Urus, Macan, Lusso
};

// Libellé affiché : le tag le plus court qui écrit le modèle au complet
//  · on ne garde que les tags qui retombent sur la clé canonique (« GTC4 Lusso », pas « GTC4Lusso »)
//  · on écarte un tag qui n'est que la fin d'un autre (« turbo s » → on affiche « 911 Turbo S »)
const pretty = (variants, key) => {
  const clean = [...new Set(variants
    .map((v) => v.replace(/\([^)]*\)/g, '').replace(STRIP, ' ').replace(/[-_/]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean))].sort((a, b) => a.length - b.length);
  const exact = clean.filter((c) => c.toLowerCase() === key);
  const pool = exact.length ? exact : clean;
  const full = pool.filter((c) => !pool.some((o) => o !== c && o.toLowerCase().endsWith(' ' + c.toLowerCase())));
  return (full[0] || pool[0] || variants[0]).split(' ').map(caseWord).join(' ');
};

// Noms commerciaux que les tags n'écrivent nulle part correctement (vérifié sur les titres produits).
const LABEL = {
  Audi: { ttrs: 'TT RS' },
  McLaren: { 'mp4 12c': 'MP4-12C' },
  Porsche: { gt3rs: 'GT3 RS' },
  'Mercedes-AMG': {
    'gt gts gtr gtc': 'AMG GT / GTS / GTR / GTC',
    'c63s e': 'C63 S E Performance',
    'glc63 s e': 'GLC63 S E Performance',
  },
};

// Tags écrits à la main par AZM, réconciliés contre les titres produits (vérifié 2026-09-16).
// clé canonique → clé canonique cible
const ALIAS = {
  Ferrari: { gtc4lusso: 'gtc4 lusso' },
  Lamborghini: { sv: 'aventador sv' },
  Porsche: { turbo: '911 turbo', 'turbo s': '911 turbo s' },
  'Mercedes-AMG': { 'glc63 e': 'glc63 s e', 'c63 e': 'c63s e', c63s: 'c63' },
};

/* Chaque marque a une photo de char dans ses collections Shopify (M3 G80, Huracán
   Sterrato, …). C'est la seule imagerie de véhicule qu'AZM possède — les 121 fiches
   produit sont des pièces seules sur plancher d'atelier. */
const COLLECTION_OF = {
  BMW: 'bmw', Porsche: 'porsche', McLaren: 'mclaren', Ferrari: 'ferrari', Audi: 'audi',
  Lamborghini: 'lamborghini', 'Mercedes-AMG': 'mercedes-benz', Chevrolet: 'chevrolet', Toyota: 'toyota',
};

async function fetchBrandImages() {
  const out = {};
  try {
    const r = await fetch(`${SHOP}/collections.json?limit=250`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const { collections } = await r.json();
    for (const [make, handle] of Object.entries(COLLECTION_OF)) {
      const c = collections.find((x) => x.handle === handle);
      if (c?.image?.src) out[make] = c.image.src.split('?')[0];
    }
  } catch (e) {
    console.log(`  ⚠ images de marque indisponibles (${e.message}) — la page retombera sur le texte`);
  }
  return out;
}

async function fetchAll() {
  const out = [];
  for (let page = 1; page <= 10; page++) {
    const r = await fetch(`${SHOP}/products.json?limit=250&page=${page}`);
    if (!r.ok) throw new Error(`products.json page ${page} → HTTP ${r.status}`);
    const { products } = await r.json();
    if (!products?.length) break;
    out.push(...products);
  }
  return out;
}

const raw = await fetchAll();
const brandImages = await fetchBrandImages();
console.log(`catalogue : ${raw.length} produits · ${Object.keys(brandImages).length} photos de marque`);

const products = {};
const makes = {};

for (const p of raw) {
  const tags = p.tags || [];
  const makeTag = tags.find((t) => /^make_/i.test(t));
  const models = tags.filter((t) => /^model_/i.test(t)).map((t) => t.slice(6));
  const years = tags.filter((t) => /^year_/i.test(t)).map((t) => +t.slice(5)).sort((a, b) => a - b);
  if (!makeTag || !models.length) { console.log(`  ⊘ ignoré (pas de make/model) : ${p.title}`); continue; }

  const make = MAKE_ALIAS[makeTag.slice(5).toLowerCase()] || makeTag.slice(5);
  const partTag = tags.find((t) => /^part_/i.test(t));
  const part = partTag ? partTag.slice(5) : (p.product_type || 'part').toLowerCase().replace(/\s+/g, '-');

  const variants = p.variants.map((v) => ({
    id: v.id, title: v.title, price: +v.price, available: v.available,
    options: [v.option1, v.option2, v.option3].filter(Boolean),
  }));

  // Le corps de fiche porte les vraies preuves : la liste « Fitments: » (années + châssis exacts),
  // les « Key Features », et la mention légale d'émissions quand la pièce est catless.
  const plain = (p.body_html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h\d|ul|ol)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#\d+;/g, ' ')
    .replace(/[ \t]+/g, ' ');
  const section = (from, to) => {
    const m = plain.match(new RegExp(from + '([\\s\\S]*?)(?:' + to + '|$)', 'i'));
    return m ? m[1].split('\n').map((l) => l.trim()).filter((l) => l.length > 3) : [];
  };

  products[p.id] = {
    id: p.id, title: p.title, handle: p.handle, make, part,
    fitments: section('Fitments?\\s*:', '(?:Key )?Features?\\s*:').slice(0, 12),
    features: section('(?:Key )?Features?\\s*:', 'Product Overview|Disclaimer|Note\\s*:').slice(0, 6),
    offroad: /emissions regulations/i.test(plain),
    years: years.length ? [years[0], years[years.length - 1]] : null,
    fits: [...new Set(models)],
    price: Math.min(...variants.map((v) => v.price)),
    priceMax: Math.max(...variants.map((v) => v.price)),
    available: variants.some((v) => v.available),
    optionNames: (p.options || []).map((o) => o.name),
    variants,
    images: p.images.map((i) => i.src.split('?')[0]),
    url: `${SHOP}/products/${p.handle}`,
  };

  const bucket = (makes[make] = makes[make] || {});
  for (const m of models) {
    const key = canon(m);
    if (!key) continue;
    const slot = (bucket[key] = bucket[key] || { variants: [], products: new Set(), years: new Set() });
    slot.variants.push(m);
    slot.products.add(p.id);
    years.forEach((y) => slot.years.add(y));
  }
}

// Fusion des doublons de tag :
//  · alias   — table explicite ci-dessus, pour les tags qu'aucune règle ne rattrape
//  · préfixe — « M2 » absorbe « M2 Comp » quand M2 Comp ne vit que sur des produits de M2
//  · suffixe — « 911 Turbo S » absorbe « Turbo S » quand les deux couvrent exactement les mêmes produits
const same = (a, b) => a.size === b.size && [...a].every((id) => b.has(id));
const subset = (a, b) => [...a].every((id) => b.has(id));

for (const [make, bucket] of Object.entries(makes)) {
  for (const [from, to] of Object.entries(ALIAS[make] || {})) {
    if (!bucket[from]) continue;
    const target = (bucket[to] = bucket[to] || { variants: [], products: new Set(), years: new Set() });
    target.variants.push(...bucket[from].variants);
    bucket[from].products.forEach((id) => target.products.add(id));
    bucket[from].years.forEach((y) => target.years.add(y));
    delete bucket[from];
  }
}

for (const bucket of Object.values(makes)) {
  for (const short of Object.keys(bucket).sort((a, b) => a.length - b.length)) {
    if (!bucket[short]) continue;
    for (const long of Object.keys(bucket)) {
      if (long === short || !bucket[long] || !bucket[short]) continue;
      if (long.endsWith(' ' + short) && same(bucket[long].products, bucket[short].products)) {
        bucket[long].variants.push(...bucket[short].variants);
        bucket[short].years.forEach((y) => bucket[long].years.add(y));
        delete bucket[short];
        break;
      }
      if (long.startsWith(short + ' ') && subset(bucket[long].products, bucket[short].products)) {
        bucket[short].variants.push(...bucket[long].variants);
        bucket[long].years.forEach((y) => bucket[short].years.add(y));
        delete bucket[long];
      }
    }
  }
}

const catalog = {
  generated: new Date().toISOString(),
  shop: SHOP,
  makes: Object.entries(makes)
    .map(([make, bucket]) => ({
      make,
      image: brandImages[make] || null,
      models: Object.entries(bucket)
        .map(([key, slot]) => {
          const years = [...slot.years].sort((a, b) => a - b);

          // Générations : on regroupe les pièces par plage d'années, puis on fusionne deux plages
          // qui se recouvrent sur au moins la moitié de la plus courte — un downpipe tagué
          // 2021-2024 et un échappement 2021-2026 sont la même génération, une M3 2015-2021 et
          // une 2021-2026 n'en sont pas (elles ne partagent qu'une année de transition).
          // Un modèle qui ne donne qu'une génération ne mérite pas qu'on demande l'année.
          const gens = [];
          [...slot.products]
            .map((id) => products[id])
            .filter((p) => p.years)
            .sort((a, b) => a.years[0] - b.years[0] || a.years[1] - b.years[1])
            .forEach((p) => {
              const last = gens[gens.length - 1];
              const overlap = last ? Math.min(last.to, p.years[1]) - Math.max(last.from, p.years[0]) + 1 : 0;
              const shortest = last ? Math.min(last.to - last.from, p.years[1] - p.years[0]) + 1 : 0;
              if (last && overlap >= shortest / 2) {
                last.from = Math.min(last.from, p.years[0]);
                last.to = Math.max(last.to, p.years[1]);
                last.products.push(p.id);
              } else {
                gens.push({ from: p.years[0], to: p.years[1], products: [p.id] });
              }
            });
          gens.forEach((g) => {
            g.chassis = [...new Set(g.products.flatMap((id) => products[id].fits
              .filter((f) => canon(f) === key && f.includes('('))
              .map((f) => (f.match(/\(([^)]+)\)/) || [])[1])
              .filter(Boolean)))].join(' / ');
          });

          return {
            key, label: (LABEL[make] || {})[key] || pretty(slot.variants, key),
            generations: gens,
            fits: [...new Set(slot.variants)].sort(),
            years: years.length ? [years[0], years[years.length - 1]] : null,
            products: [...slot.products],
          };
        })
        .sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true })),
    }))
    .sort((a, b) => a.make.localeCompare(b.make)),
  products,
};

writeFileSync(resolve(HERE, 'catalog.json'), JSON.stringify(catalog, null, 1));
// Version <script> : la page s'ouvre en double-clic, sans serveur local (fetch est bloqué en file://).
writeFileSync(resolve(HERE, 'catalog.js'), `window.AZM_CATALOG = ${JSON.stringify(catalog)};\n`);
const nModels = catalog.makes.reduce((s, m) => s + m.models.length, 0);
console.log(`→ catalog.json : ${catalog.makes.length} marques · ${nModels} modèles · ${Object.keys(products).length} produits`);
for (const m of catalog.makes) console.log(`   ${m.make.padEnd(14)} ${m.models.map((x) => x.label).join(' · ')}`);
