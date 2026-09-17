#!/usr/bin/env node
// Capture la landing dans Chrome headless — pour la voir au lieu de la deviner.
// Chrome est déjà installé sur la machine : aucune dépendance à ajouter.
//
//   node shot.mjs                      les 3 largeurs de l'écran d'accueil
//   node shot.mjs "?make=BMW&model=m3" un état précis (deep link)
//   node shot.mjs "" 390               une seule largeur
//
// Les images sortent dans le dossier temporaire de la session.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.SHOT_DIR
  || 'C:/Users/samub/AppData/Local/Temp/claude/c--Users-samub-tps-agent-os/2eb7126e-ed3d-40e6-8db1-ecc18b7516d3/scratchpad/shots';

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p));
if (!CHROME) { console.error('Ni Chrome ni Edge trouvé.'); process.exit(1); }

const query = process.argv[2] || '';
const only = process.argv[3];
const sizes = only ? [[Number(only), 900]] : [[390, 844], [820, 1100], [1440, 900]];

mkdirSync(OUT, { recursive: true });
/* La page est servie par Next : il faut un serveur en face (`npm run dev`, ou
   `npm run build && npm start` pour capturer ce qui partira vraiment en production).
   AZM_URL vise une autre adresse — une préproduction Vercel, par exemple. */
const BASE = (process.env.AZM_URL || 'http://localhost:3000').replace(/\/$/, '');
const page = BASE + '/' + (query && !query.startsWith('?') ? '?' + query : query);
const tag = (query.replace(/[^a-z0-9]+/gi, '') || 'home').slice(0, 24);

for (const [w, h] of sizes) {
  const file = `${OUT}/${tag}-${w}.png`;
  execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars',
    '--force-device-scale-factor=1',   // sinon l'échelle Windows (125 %) fausse la largeur rendue
    /* Sans --disable-lcd-text, le rendu sous-pixel (ClearType) pose des franges de
       couleur sur le petit texte clair sur fond noir : le pied de page ressortait
       franchement bleu sur les captures alors qu'il est gris dans un vrai navigateur.
       Une capture qui ment fait corriger des bogues qui n'existent pas. */
    '--disable-lcd-text',
    '--force-color-profile=srgb',
    '--virtual-time-budget=4000',          // laisse le JS peindre et les polices charger
    `--window-size=${w},${h}`,
    `--screenshot=${file}`,
    page,
  ], { stdio: 'pipe' });
  console.log(`${String(w).padStart(5)} px → ${file}`);
}
