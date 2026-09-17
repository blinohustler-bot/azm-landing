#!/usr/bin/env node
// Nettoie les SVG de logos pour un fond sombre :
//  1. retire le rectangle de fond que les banques de logos collent derrière (le carré blanc)
//  2. passe en blanc les logos dessinés en noir, qui disparaîtraient autrement
// Idempotent : relancer ne casse rien.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'assets/brands');

// Logos dessinés en noir : sur fond noir il faut les repeindre en blanc.
// (Les constructeurs publient tous une version monochrome blanche pour ça.)
const TO_WHITE = new Set(['ferrari', 'porsche', 'audi', 'mclaren']);

for (const file of readdirSync(DIR).filter((f) => f.endsWith('.svg'))) {
  const slug = file.replace('.svg', '');
  const path = resolve(DIR, file);
  let svg = readFileSync(path, 'utf8');
  const before = svg.length;

  // 1. le rectangle de fond : un path qui redessine exactement le viewBox
  const vb = (svg.match(/viewBox="([\d.\s-]+)"/) || [])[1];
  if (vb) {
    const [, , w, h] = vb.trim().split(/\s+/).map(Number);
    const wS = String(w).replace('.', '\.');
    const hS = String(h).replace('.', '\.');
    const bg = new RegExp(
      `<path[^>]*d="M0 0[hH]${wS}[vV]?${hS}?[hH]?[-\d.]*[vV]?[-\d.]*[Hh]?0[ ]?[vV]?0?[zZ]?"[^>]*/>`,
      'g'
    );
    svg = svg.replace(bg, '');
    // variante : <rect> plein cadre
    svg = svg.replace(/<rect[^>]*width="100%"[^>]*height="100%"[^>]*\/>/g, '');
    svg = svg.replace(new RegExp(`<rect[^>]*width="${wS}"[^>]*height="${hS}"[^>]*/>`, 'g'), '');
  }

  // 2. repeindre en blanc ce qui est noir (ou sans couleur, donc noir par défaut)
  if (TO_WHITE.has(slug)) {
    svg = svg.replace(/fill="#(000000|000|010101|1a1a1a|231f20)"/gi, 'fill="#ffffff"');
    svg = svg.replace(/fill:\s*#(000000|000|010101|231f20)/gi, 'fill:#ffffff');
    svg = svg.replace(/stroke="#(000000|000)"/gi, 'stroke="#ffffff"');
    // les paths sans fill valent noir par défaut : on impose le blanc sur la racine
    if (!/<svg[^>]*\sfill=/.test(svg)) svg = svg.replace(/<svg\b/, '<svg fill="#ffffff"');
  }

  writeFileSync(path, svg);
  console.log(`${slug.padEnd(14)} ${before} → ${svg.length} b${TO_WHITE.has(slug) ? '  (repeint en blanc)' : ''}`);
}
