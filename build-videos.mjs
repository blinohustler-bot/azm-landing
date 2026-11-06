#!/usr/bin/env node
// AZM — associe une vidéo YouTube d'AZ à chaque pièce du catalogue, quand il en existe
// une qui montre VRAIMENT ce char-là avec CE type de pièce.
// Sortie : videos.json — lu côté serveur par lib/videos.ts.
//
//   node build-videos.mjs                       lit l'inventaire de Tyler (chemin par défaut)
//   node build-videos.mjs chemin/videos.json    ou un autre inventaire
//
// D'OÙ VIENNENT LES VIDÉOS
// L'inventaire des 201 vidéos de la chaîne a été fait pour l'assistant Tyler
// (azm-tyler/knowledge/videos.json : id, titre, vues). La landing n'en dépend pas à
// l'exécution : ce script recopie ici le strict nécessaire, comme build-index.mjs le
// fait pour le catalogue.
//
// LA RÈGLE, ET POURQUOI ELLE EST ÉCRITE À LA MAIN
// La clientèle d'AZM est pointue : une M4 présentée comme une M3, une 991 comme une
// 992, et le visiteur referme l'onglet en se disant que le reste de la page ment aussi.
// Un rapprochement « intelligent » sur les titres se tromperait exactement là — les
// titres portent des hashtags d'autres chars (#m340i sous une M240i), des générations
// ambiguës (« RS3 » seul : 8V ou 8Y ?), des combinaisons (downpipes + échappement).
//
// Donc : une table RULES, une entrée par fiche, écrite et relue à la main. Une fiche
// absente de la table n'a pas de vidéo, et c'est le cas par défaut. En cas de doute,
// pas d'entrée. Le script ne fait qu'appliquer la table aux titres, de façon
// vérifiable, et imprime ce qu'il a retenu pour que quelqu'un relise.
//
// Chaque entrée dit :
//   part   le type de pièce de la fiche — la vidéo DOIT montrer ce type-là ;
//   cars   les chars admis, chacun avec son libellé à l'écran (« a G80 M3 ») et les
//          clés de modèle du catalogue pour lesquelles c'est LE MÊME char. La carte
//          n'affiche la vidéo qu'au visiteur dont le modèle est dans cette liste :
//          jamais la vidéo d'une M4 sous une M3, même quand la pièce est la même ;
//   must   (facultatif) ce que le titre doit contenir (une regex, ou une liste : toutes) pour lever une ambiguïté de
//          génération (« gen 3 », « w213 », « 2021 ») ;
//   not    (facultatif) ce qui disqualifie (« 992.2 » sur une fiche 992.1, « se »…).

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = process.argv[2] || 'C:/Users/Admin/Documents/azm-tyler/knowledge/videos.json';

/* SOURCE : LA RÈGLE « AZM », LA MÊME POUR TOUTES LES FICHES
   Toutes les vidéos de l'inventaire viennent de la chaîne YouTube d'AZ Motorsport.
   Une pièce nommée dans le titre d'une de ces vidéos est donc tenue pour une pièce
   AZM, que le titre écrive « AZM » ou non (« A90 Supra B58 with catless downpipes »
   ne le dit pas, et c'est bien leur downpipe). On n'exige « AZM » dans le titre
   nulle part, et on n'écarte aucune vidéo pour son absence. Les exceptions ne
   portent que sur le CHAR (génération, carrosserie) et sur les pièces hors
   catalogue (GLOBAL_OUT). */

/* ── lecture d'un titre ──────────────────────────────────────────────────── */

/* Le titre tel qu'on le juge : en minuscules, sans hashtags (ils nomment d'autres
   chars : « M240i … #m340i »), et sans les pièces d'origine (« with original
   downpipes », « with stock headers », « with OEM exhaust ») — une pièce d'origine
   n'est pas une pièce AZM, elle ne fait pas de la vidéo une combinaison. */
export function cleanTitle(title) {
  return title
    .toLowerCase()
    .replace(/#\S+/g, ' ')
    .replace(/\b(original|stock|oem)\s+(down ?pipes?|headers?|exhaust)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* Les types de pièce que montre une vidéo. « Straight pipe » et « x pipe » sont des
   configurations d'échappement du catalogue ; « front pipes » est le nom que la fiche
   Corvette donne à ses downpipes. */
const PART_RE = {
  downpipe: /\bdown ?pipes?\b|\bdowpipes?\b|\bfront pipes?\b/,
  'exhaust-system': /\bexhaust\b|\bcat ?back\b|\bstraight pipe\b|\bx ?pipe\b/,
  headers: /\bheaders?\b/
};

export function partsIn(clean) {
  return Object.keys(PART_RE).filter((k) => PART_RE[k].test(clean));
}

/* Ce qui rend une vidéo inutilisable pour TOUTES les fiches :
   - une pièce qui n'est pas au catalogue (admissions, Z-pipe) : le son entendu n'est
     plus celui de la pièce vendue ;
   - deux chars dans la même vidéo (« vs », « battle ») ;
   - la vidéo de présentation de l'atelier. */
const GLOBAL_OUT = /\bintakes?\b|\bz ?pipe\b|\bvs\.?\b|\bbattle\b|\bheadquarters\b/;

/* Une préparation moteur change le son (pétarades d'une cartographie) : la vidéo
   reste vraie — la pièce y est — mais on préfère celle où l'on entend la pièce seule. */
const TUNED = /\bstage ?2\b|(?<!no )\btune\b|\bs4t\b|stage4tuning|\bdyno\b|\b\d{3,4} ?hp\b|\becu\b/;

/* ── la table ────────────────────────────────────────────────────────────── */

const car = (re, label, models) => ({ re, label, models });

export const RULES = {
  /* Audi ─────────────────────────────────────────────────────────────────── */
  /* « RS3 » seul peut être une 8V (fiche RS3/TTRS) : on exige 8Y ou un millésime 8Y. */
  'azm-audi-rs3-8y-downpipe': {
    part: 'downpipe', must: /\b8y\b|\by8\b|\brs3 ?8y\b|\b202[3-6]\+?\b/,
    cars: [car(/\brs ?3\b/, 'an RS3 8Y', ['rs3'])]
  },
  'azm-audi-rs3-8y-race-exhaust-system': {
    part: 'exhaust-system', must: /\b8y\b|\by8\b|\brs3 ?8y\b|\b202[3-6]\+?\b/,
    cars: [car(/\brs ?3\b/, 'an RS3 8Y', ['rs3'])]
  },
  /* La RS5 B8 est atmosphérique : seule la B9 a des downpipes. On exige quand même
     « B9 » dans le titre pour la fiche downpipes. */
  '3404-azm-rs5-b9-downpipe-catless-2018': {
    part: 'downpipe', must: /\bb9\b/,
    cars: [car(/\brs ?5\b/, 'an RS5 B9', ['rs5'])]
  },
  /* Échappement RS5 (B9) : aucune vidéo ne nomme la génération, mais toutes montrent
     aussi des downpipes — preuve d'une RS5 turbo, donc d'une B9. */
  'azm-audi-rs5-b9-exhaust': {
    part: 'exhaust-system', must: /\bdown ?pipes?\b/, not: /\bb8\b/,
    cars: [car(/\brs ?5\b/, 'an RS5 B9', ['rs5'])]
  },
  /* RS6 et RS7 : deux carrosseries, deux libellés. Le char retenu est celui que le
     titre nomme en premier (« RS7/RS6 C8 » → RS7). La C7 existe aussi : on exige C8. */
  '3440-azm-rs6-rs7-c8-2020-downpipe-catless': {
    part: 'downpipe', must: /\bc8\b/,
    cars: [car(/\brs ?7\b/, 'an RS7 C8', ['rs7']), car(/\brs ?6\b/, 'an RS6 C8', ['rs6'])]
  },
  '3440-azm-audi-rs6-c8-titanium-catback-with-valve-include-the-front-pipe': {
    part: 'exhaust-system', must: /\bc8\b/,
    cars: [car(/\brs ?7\b/, 'an RS7 C8', ['rs7']), car(/\brs ?6\b/, 'an RS6 C8', ['rs6'])]
  },
  /* La fiche RSQ8 sert aussi la SQ8 et la SQ7 dans le catalogue. La vidéo est une
     SQ8 : elle n'est montrée qu'au visiteur qui a choisi SQ8. */
  '3818-azm-rsq8-sq8-downpipe-catless-2018': {
    part: 'downpipe',
    cars: [car(/(?<!r)\bsq ?8\b/, 'an SQ8', ['sq8']), car(/\brsq ?8\b/, 'an RSQ8', ['rsq8'])]
  },
  /* Fiche R8 2017–2023 (2e génération). « V10+ » existe sur les deux générations ;
     seule « V10 Performance » est certainement une 2e génération. */
  '2488-azm-audi-r8-titanium-catback-2015-with-valve-and-muffler': {
    part: 'exhaust-system', must: /\bv10 performance\b/,
    cars: [car(/\br8\b/, 'an R8 V10 Performance', ['r8'])]
  },

  /* BMW ──────────────────────────────────────────────────────────────────── */
  'azm-g80-m3-g2-m4-3-0t-downpipe-catless-2021': {
    part: 'downpipe', not: /\bf8[0-7]\b/,
    cars: [
      car(/\bg80\b/, 'a G80 M3', ['m3']),
      car(/\bg82\b/, 'a G82 M4', ['m4']),
      car(/\bg87\b/, 'a G87 M2', ['m2'])
    ]
  },
  '2380-azm-bmw-g80-m3-g82-m4-catback-2020': {
    part: 'exhaust-system', not: /\bf8[0-7]\b/,
    cars: [car(/\bg80\b/, 'a G80 M3', ['m3']), car(/\bg82\b/, 'a G82 M4', ['m4'])]
  },
  /* La M2 G87 a sa propre fiche d'échappement : une vidéo « G80/G82/G87 » montre
     d'abord une G80, elle n'est pas pour cette fiche. */
  'bmw-s58-m2-g87-race-exhaust-system': {
    part: 'exhaust-system', not: /\bg80\b|\bg82\b/,
    cars: [car(/\bg87\b/, 'a G87 M2', ['m2'])]
  },
  'azm-s55-bmw-m3-m4-m2-f80-f82-f22-f87': {
    part: 'downpipe',
    cars: [car(/\bf80\b/, 'an F80 M3 CS', ['m3']), car(/\bf82\b/, 'an F82 M4', ['m4'])]
  },
  'azm-s63-bmw-downpipes-m8-f91-f92': {
    part: 'downpipe',
    cars: [car(/\bm8\b/, 'an M8 Competition', ['m8'])]
  },
  'azm-s63-bmw-exhaust-m8f92': {
    part: 'exhaust-system',
    cars: [car(/\bm8\b/, 'an M8 Competition', ['m8'])]
  },
  /* « M5 Competition » seul peut être une F10 : on exige F90. */
  'azm-s63-bmw-downpipe-m5-f90': {
    part: 'downpipe', must: /\bf90\b/,
    cars: [car(/\bm5\b/, 'an M5 F90', ['m5'])]
  },
  'azm-s68-bmw-exhaust-m5-g90-g99': {
    part: 'exhaust-system', must: /\bg9[09]\b/,
    cars: [car(/\bm5\b/, 'an M5 G90', ['m5'])]
  },
  /* X5M/X6M : « F95 » couvre les deux générations (S63 2020–2023, S68 LCI 2024+). Seule
     une vidéo qui nomme le moteur S63 sert la fiche S63. */
  'azm-s63-bmw-downpipe-x5m-x6m-f95-f96': {
    part: 'downpipe', must: /\bs63\b/,
    cars: [car(/\bx6m\b/, 'an X6M F96', ['x6m']), car(/\bx5m\b/, 'an X5M F95', ['x5m'])]
  },
  'n63r-bmw-m550i-m850i-g30-g15-downpipes': {
    part: 'downpipe',
    cars: [car(/\bm850i\b/, 'an M850i', ['m850i']), car(/\bm550i\b/, 'an M550i', ['m550i'])]
  },
  /* B58 : trois générations de downpipe pour les mêmes noms de char. Une M340i peut
     être GEN2 ou GEN3 selon l'année : seul un titre qui dit la génération compte. */
  'bmw-b58-gen-3-downpipe': {
    part: 'downpipe', must: /\bgen ?3\b/,
    cars: [car(/\bm340i?\b/, 'an M340i', ['m340i']), car(/\bm440i?\b/, 'an M440i', ['m440i'])]
  },
  'b58-downpipe-catless-for-2019-bmw-m340i-m440i-m240i-x5-40i-xdrive-g20-g22-g26-g05': {
    part: 'downpipe', must: /\bgen ?2\b|\bg42\b/,
    cars: [
      car(/\bm340i?\b/, 'an M340i', ['m340i']),
      car(/\bm440i?\b/, 'an M440i', ['m440i']),
      car(/\bm240i\b/, 'an M240i G42', ['m240i'])
    ]
  },
  /* Échappement B58 2019–2024 : une M340i de 2025+ pourrait être une GEN3. On exige un
     millésime dans la plage de la fiche. */
  'b58-bmw-m340i-m440i-m240i-g20-g22-g42-valved-exhaust-system': {
    part: 'exhaust-system', must: /\b(2019|2020|2021|2022|2023|2024)\b/,
    cars: [car(/\bm340i?\b/, 'an M340i', ['m340i'])]
  },

  /* Toyota ───────────────────────────────────────────────────────────────── */
  'azm-b58-toyota-supra-a90-downpipe-catless-2020': {
    part: 'downpipe',
    cars: [car(/\bsupra\b/, 'a Supra A90', ['supra'])]
  },

  /* Mercedes-AMG ─────────────────────────────────────────────────────────── */
  /* GT63S X290 2019–2023. La GT63 S E Performance (hybride, 2024+) a sa propre fiche
     ailleurs et un autre son : exclue. On exige X290 ou un millésime de la plage. */
  'azm-mercedes-gt63-gt63s-performance-downpipes': {
    part: 'downpipe', must: /\bx290\b|\b(2019|2020|2021|2022|2023)\b/,
    not: /\bgt63 ?se\b|\bperfomance\b|\bperformance\b|\b202[4-6]\b/,
    cars: [car(/\bgt ?63 ?s\b/, 'a GT63S', ['gt63s'])]
  },
  /* C63S : la W205 d'avant 2019 a le même V8, la W206 (2024+) n'en a plus. La fiche
     est la W205 facelift (2019–2021) : on exige un millésime de la plage. */
  'azm-mercedes-c63s-facelift-w205-downpipes': {
    part: 'downpipe', must: /\b(2019|2020|2021)\b/,
    cars: [car(/\bc63 ?s?\b/, 'a C63S', ['c63'])]
  },
  /* « E63S » seul peut être une W212. On exige W213. */
  'azm-mercedes-e63-w213-downpipes': {
    part: 'downpipe', must: /\bw213\b/,
    cars: [car(/\be63 ?s?\b/, 'an E63S W213', ['e63'])]
  },
  /* GLE63S W166 (2016–2019) existe aussi. La fiche est W167 2021+ : millésime exigé. */
  'azm-mercedes-gle63-w167-downpipes': {
    part: 'downpipe', must: /\bw167\b|\b202[1-6]\b/,
    cars: [car(/\bgle ?63 ?s?\b/, 'a GLE63S', ['gle63'])]
  },

  /* Porsche ──────────────────────────────────────────────────────────────── */
  'azm-porsche-cayenne-downpipe-gts-turbo-turbo-gt': {
    part: 'downpipe',
    cars: [car(/\bcayenne turbo gt\b|\bturbo gt\b/, 'a Cayenne Turbo GT', ['cayenne turbo gt'])]
  },
  'azm-porsche-macan': {
    part: 'downpipe',
    cars: [car(/\bmacan\b/, 'a Macan', ['macan'])]
  },
  /* 992 Carrera : jamais une Turbo ni une GT3, qui ont leurs propres fiches. */
  'azm-porsche-911-992-downpipes': {
    part: 'downpipe', must: /\b992(\.1)?\b/, not: /\bturbo\b|\bgt3\b/,
    cars: [car(/\bcarrera\b/, 'a 992 Carrera 4 GTS', ['911 carrera'])]
  },
  /* GT3 992 : deux fiches d'échappement. Les vidéos disent « F1 » : elles vont à la
     fiche « Full F1 Exhaust », jamais à la « Race Exhaust System » à valves — on ne
     sait pas laquelle des deux est montrée quand le titre ne dit pas F1, donc la fiche
     à valves n'a pas de vidéo. */
  'azm-porsche-gt3-gt3-rs-992': {
    /* « GT3 Full F1 » sans génération peut être une 991, qui a sa propre fiche F1. */
    part: 'exhaust-system', must: [/\bf1\b/, /\b992(\.[12])?\b|\b202[2-6]\b/], not: /\bgt3 ?rs\b|\btouring\b/,
    cars: [car(/\bgt3\b/, 'a 992 GT3', ['gt3'])]
  },
  'azm-porsche-gt3-gt3-rs-992-racing-headers': {
    part: 'headers', must: /\b992(\.[12])?\b/, not: /\bgt3 ?rs\b/,
    cars: [car(/\bgt3\b/, 'a 992 GT3', ['gt3'])]
  },

  /* Lamborghini ──────────────────────────────────────────────────────────── */
  'azm-lamborghini-urus': {
    part: 'downpipe',
    cars: [car(/\burus\b/, 'a Urus', ['urus'])]
  },
  '3340-azm-lamborghini-urus-2018-titanium-exhaust-system-catback': {
    part: 'exhaust-system',
    cars: [car(/\burus\b/, 'a Urus', ['urus'])]
  },
  /* Aventador LP700 / S / SV — jamais la SVJ, qui a sa propre fiche. */
  'azm-lamborghini-aventador-s-sv-downpipes': {
    /* « Aventador » seul peut être une S ou une SV : on exige LP700. */
    part: 'downpipe', must: /\blp ?700\b/, not: /\bsvj\b/,
    cars: [car(/\baventador\b/, 'an Aventador LP700', ['aventador'])]
  },
  'azm-lamborghini-aventador-svj-ultimae-downpipes': {
    part: 'downpipe',
    cars: [car(/\bsvj\b/, 'an Aventador SVJ', ['aventador svj'])]
  },
  'lamborghini-aventador-svj-titanium-high-performance-valvetronic-exhaust': {
    part: 'exhaust-system',
    cars: [car(/\bsvj\b/, 'an Aventador SVJ', ['aventador svj'])]
  },
  /* Huracán LP580/LP610 — jamais l'EVO/STO, qui a sa propre fiche. */
  '2808-azm-lamborghini-lp610-with-valve-and-muffler': {
    part: 'exhaust-system', must: /\blp ?(580|610)\b/, not: /\bevo\b|\bsto\b/,
    cars: [car(/\bhuracan\b/, 'a Huracan LP610', ['huracan'])]
  },

  /* McLaren ──────────────────────────────────────────────────────────────── */
  'mclaren-600lt-675lt-downpipes': {
    part: 'downpipe',
    cars: [car(/\b600 ?lt\b/, 'a 600LT', ['600lt']), car(/\b675 ?lt\b/, 'a 675LT', ['675lt'])]
  },
  '3870-azm-mclaren-720s-downpipe-catless-2018': {
    part: 'downpipe',
    cars: [car(/\b720 ?s\b/, 'a 720S', ['720s'])]
  },
  '3870-azm-mclaren-720s-x-pipe-2017-titanium-exhaust-system-catback': {
    part: 'exhaust-system',
    cars: [car(/\b720 ?s\b/, 'a 720S', ['720s'])]
  },

  /* Ferrari ──────────────────────────────────────────────────────────────── */
  'azm-ferrari-sf90-downpipe': {
    part: 'downpipe',
    cars: [car(/\bsf90\b/, 'an SF90', ['sf90'])]
  },
  /* Même règle de chaîne que partout (voir SOURCE) : « SF90 1300HP … Catless
     Downpipes + Catback Exhaust » vient de la chaîne d'AZ, l'échappement compte comme
     le leur. C'est une combinaison, et la carte le dit. */
  'azm-ferrari-sf90-exhaust': {
    part: 'exhaust-system',
    cars: [car(/\bsf90\b/, 'an SF90', ['sf90'])]
  },
  /* Les vidéos montrent une 812 GTS ; la fiche couvre Superfast et GTS (même V12).
     Un seul char admis : une deuxième vidéo pour le même modèle ne serait jamais
     montrée (la carte prend la première), ce serait de la donnée morte. */
  'ferrari-812-superfast-downpipe': {
    part: 'downpipe',
    cars: [car(/\b812 gts\b/, 'an 812 GTS', ['812'])]
  },
  'ferrari-812-titanium-valved-exhaust': {
    part: 'exhaust-system',
    cars: [car(/\b812 gts\b/, 'an 812 GTS', ['812'])]
  },
  'ti-3862-azm-ferrari-f8-tributo-3-9t-v8-titanium-downpipe-2020': {
    part: 'downpipe',
    cars: [car(/\bf8\b/, 'an F8', ['f8'])]
  }

  /* Volontairement absents, faute de certitude :
     - Corvette C8 : la seule vidéo (« Corvette C8 … ») porte à la fois #stingray et
       #z06, et les deux ont des fiches différentes.
     - Mercedes S63 W222 : « S63 … M177 » est aussi le moteur de la W223 (2023+).
     - RS3/TTRS 8V : « Audi RS3 » sans génération.
     - GT3 992 « Race Exhaust System » à valves : voir la règle F1 ci-dessus.
     - 911 Turbo S 992 (downpipes, collecteurs, échappement) : la seule vidéo montre
       les trois pièces plus des downpipes high flow ensemble ; le son entendu est
       trop loin de n'importe laquelle des trois fiches prise seule.
     - X5M/X6M S68 LCI, échappements S63 : aucun titre ne nomme la génération. */
};

/* ── application ─────────────────────────────────────────────────────────── */

/* Le char nommé EN PREMIER dans le titre : « Audi RS7/RS6 C8 » est une RS7. */
function firstCar(rule, clean) {
  let best = null;
  for (const c of rule.cars) {
    const m = c.re.exec(clean);
    if (m && (!best || m.index < best.at)) best = { car: c, at: m.index };
  }
  return best?.car ?? null;
}

/* Une combinaison se dit sous le bouton : « Hear it on a 720S » sur la fiche
   échappement, quand la vidéo a aussi des downpipes AZM, laisserait croire que tout
   le son vient de l'échappement. Null quand la vidéo montre la pièce seule. */
const PART_NAME = { downpipe: 'downpipes', 'exhaust-system': 'exhaust', headers: 'headers' };
export function alsoPhrase(others) {
  if (!others.length) return null;
  return `Build also runs the AZM ${others.map((p) => PART_NAME[p]).join(' and ')}`;
}

/* Le meilleur d'abord : la pièce seule avant une combinaison, sans préparation avant
   avec, puis la plus regardée. */
function score(v) {
  return (v.pure ? 1000 : 0) + (v.tuned ? 0 : 100) + Math.log10((v.views || 0) + 1);
}

export function associate(videos, catalogHandles) {
  const out = {};
  const report = [];
  for (const [handle, rule] of Object.entries(RULES)) {
    if (catalogHandles && !catalogHandles.has(handle)) {
      throw new Error(`RULES vise une fiche absente du catalogue : ${handle}`);
    }
    const hits = [];
    for (const v of videos) {
      /* Les Shorts (196 sur 201) sont verticaux : la carte en tient compte. */
      if (v.kind && v.kind !== 'video' && v.kind !== 'short') continue;
      const clean = cleanTitle(v.title);
      if (GLOBAL_OUT.test(clean)) continue;
      const parts = partsIn(clean);
      if (!parts.includes(rule.part)) continue;
      if (rule.must && ![].concat(rule.must).every((re) => re.test(clean))) continue;
      if (rule.not && rule.not.test(clean)) continue;
      const c = firstCar(rule, clean);
      if (!c) continue;
      hits.push({
        id: v.id, title: v.title, views: v.views || 0, label: c.label, models: c.models,
        vertical: v.kind === 'short',
        pure: parts.length === 1, tuned: TUNED.test(clean),
        also: alsoPhrase(parts.filter((p) => p !== rule.part))
      });
    }
    /* Une vidéo par char : la meilleure pour la G80, la meilleure pour la G82… */
    const byLabel = new Map();
    for (const h of hits.sort((a, b) => score(b) - score(a))) {
      if (!byLabel.has(h.label)) byLabel.set(h.label, h);
    }
    const picks = [...byLabel.values()];
    if (picks.length) {
      out[handle] = picks.map(({ id, label, models, pure, vertical, title, also }) => ({
        id, label, models, vertical, combo: !pure, also, title
      }));
      for (const p of picks) report.push({ handle, ...p });
    }
  }
  return { products: out, report };
}

/* ── exécution directe ───────────────────────────────────────────────────── */

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const videos = JSON.parse(readFileSync(SRC, 'utf8'));
  const catalog = JSON.parse(readFileSync(resolve(HERE, 'catalog.json'), 'utf8'));
  const handles = new Set(Object.values(catalog.products).map((p) => p.handle));
  const { products, report } = associate(videos, handles);

  writeFileSync(resolve(HERE, 'videos.json'), JSON.stringify({
    generated: new Date().toISOString(),
    source: 'azm-tyler/knowledge/videos.json',
    products
  }, null, 2) + '\n');

  for (const r of report) {
    console.log(`${r.handle}\n   → ${r.label.padEnd(22)} ${r.id}  ${r.pure ? 'seule' : 'COMBO'}${r.tuned ? ' +prépa' : ''}  ${r.title}`);
  }
  console.log(`\n${Object.keys(products).length} fiches avec vidéo, ${report.length} vidéos retenues, sur ${videos.length} inventoriées.`);
}
