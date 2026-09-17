#!/usr/bin/env node
// Recadre le viewBox de chaque logo sur son contenu réel.
//
// Pourquoi : les banques de logos livrent un SVG dans un cadre carré, le dessin
// au milieu. Le McLaren, par exemple, est un bloc horizontal dans un viewBox
// carré — il n'occupe qu'un tiers de la hauteur. Résultat, à hauteur CSS égale,
// un logo se rend deux fois plus petit qu'un autre et la grille part en morceaux.
// On calcule donc la boîte englobante des tracés et on réécrit le viewBox dessus.
//
// La bbox est légèrement généreuse : les points de contrôle des courbes de Bézier
// sont comptés alors que la courbe passe en deçà. C'est sans conséquence ici —
// on cherche à égaliser des logos, pas à découper au pixel.
//
// Idempotent : un fichier déjà recadré ne bouge plus (la bbox remplit son viewBox).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'assets/brands');
const NUM = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;

// Nombre d'arguments par commande, et lesquels sont des coordonnées (x,y)
const ARGS = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };

function pathBounds(d, box) {
  const tokens = d.match(/[a-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
  let cmd = 'm', x = 0, y = 0, startX = 0, startY = 0, i = 0;

  const hit = (px, py) => {
    if (!Number.isFinite(px) || !Number.isFinite(py)) return;
    box.minX = Math.min(box.minX, px); box.maxX = Math.max(box.maxX, px);
    box.minY = Math.min(box.minY, py); box.maxY = Math.max(box.maxY, py);
  };

  while (i < tokens.length) {
    if (/^[a-z]$/i.test(tokens[i])) { cmd = tokens[i]; i++; }
    const lower = cmd.toLowerCase();
    const rel = cmd === lower;
    const n = ARGS[lower];
    if (n === undefined) { i++; continue; }
    if (lower === 'z') { x = startX; y = startY; continue; }

    const a = tokens.slice(i, i + n).map(Number);
    if (a.length < n) break;
    i += n;

    if (lower === 'h') { x = rel ? x + a[0] : a[0]; hit(x, y); }
    else if (lower === 'v') { y = rel ? y + a[0] : a[0]; hit(x, y); }
    else if (lower === 'a') {
      x = rel ? x + a[5] : a[5]; y = rel ? y + a[6] : a[6]; hit(x, y);
    } else {
      // les paires (x,y) de la commande, y compris les points de contrôle
      for (let k = 0; k + 1 < n; k += 2) {
        hit(rel ? x + a[k] : a[k], rel ? y + a[k + 1] : a[k + 1]);
      }
      x = rel ? x + a[n - 2] : a[n - 2];
      y = rel ? y + a[n - 1] : a[n - 1];
    }
    if (lower === 'm') { startX = x; startY = y; cmd = rel ? 'l' : 'L'; }
  }
}

for (const file of readdirSync(DIR).filter((f) => f.endsWith('.svg'))) {
  const full = resolve(DIR, file);
  let svg = readFileSync(full, 'utf8');

  const vbMatch = svg.match(/viewBox="([^"]+)"/);
  if (!vbMatch) { console.log(`${file.padEnd(18)} pas de viewBox — ignoré`); continue; }
  const [vx, vy, vw, vh] = vbMatch[1].trim().split(/[\s,]+/).map(Number);

  const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const m of svg.matchAll(/\sd="([^"]+)"/g)) pathBounds(m[1], box);
  // <circle>, <ellipse> et <rect> comptent aussi
  for (const m of svg.matchAll(/<(circle|ellipse)[^>]*>/g)) {
    const get = (k) => Number((m[0].match(new RegExp(k + '="([\\d.-]+)"')) || [])[1]);
    const cx = get('cx') || 0, cy = get('cy') || 0;
    const rx = get('r') || get('rx') || 0, ry = get('r') || get('ry') || 0;
    box.minX = Math.min(box.minX, cx - rx); box.maxX = Math.max(box.maxX, cx + rx);
    box.minY = Math.min(box.minY, cy - ry); box.maxY = Math.max(box.maxY, cy + ry);
  }

  if (!Number.isFinite(box.minX) || box.maxX <= box.minX) {
    console.log(`${file.padEnd(18)} contenu illisible — laissé tel quel`);
    continue;
  }

  // on borne à l'intérieur du viewBox d'origine (une bbox de Bézier peut déborder)
  const minX = Math.max(box.minX, vx), minY = Math.max(box.minY, vy);
  const maxX = Math.min(box.maxX, vx + vw), maxY = Math.min(box.maxY, vy + vh);
  const w = maxX - minX, h = maxY - minY;
  const fill = ((w * h) / (vw * vh) * 100).toFixed(0);

  if (w / vw > 0.93 && h / vh > 0.93) {   // marge : le padding ajouté laisse ~96 %, sinon on rognerait à chaque passe
    console.log(`${file.padEnd(18)} déjà cadré`);
    continue;
  }

  const pad = Math.max(w, h) * 0.02;
  const nvb = [minX - pad, minY - pad, w + pad * 2, h + pad * 2].map((v) => +v.toFixed(2)).join(' ');
  if (nvb === vbMatch[1].trim()) { console.log(`${file.padEnd(18)} inchangé`); continue; }
  svg = svg.replace(/viewBox="[^"]+"/, `viewBox="${nvb}"`)
    .replace(/\s(width|height)="[^"]*"/g, '');   // sinon la taille fixe écrase le nouveau cadre

  writeFileSync(full, svg);
  console.log(`${file.padEnd(18)} ${vw.toFixed(0)}×${vh.toFixed(0)} → ${w.toFixed(0)}×${h.toFixed(0)}`
    + `  (le dessin occupait ${fill}% du cadre)`);
}
