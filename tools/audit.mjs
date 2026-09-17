#!/usr/bin/env node
// Liste les éléments qui débordent horizontalement, largeur par largeur.
// Un débordement de quelques pixels ne se voit pas à l'œil sur une capture, mais il
// fait apparaître une barre de défilement horizontale sur téléphone — et c'est le
// premier réflexe de fermeture d'une page de campagne.
//
//   node tools/audit.mjs            390 / 820 / 1440 px
//   node tools/audit.mjs 390        une seule largeur
//
// La page est servie par Next : lancer `npm run dev` (ou `npm start`) d'abord.
// AZM_URL change l'adresse visée. AZM_PATH vise une autre étape du parcours,
// par exemple : AZM_PATH="/?make=BMW&model=m3" node tools/audit.mjs
//
// Chrome est déjà installé sur la machine : aucune dépendance à ajouter.
// --force-device-scale-factor=1 est obligatoire : sans lui, l'échelle Windows à 125 %
// fait rendre une fenêtre de 390 px à 485 px CSS et fabrique des bugs qui n'existent pas.

import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p));
if (!CHROME) { console.error('Ni Chrome ni Edge trouvé.'); process.exit(1); }

const BASE = (process.env.AZM_URL || 'http://localhost:3000').replace(/\/$/, '');
const PATH_ = process.env.AZM_PATH || '/';
const url = BASE + PATH_;

/* La sonde mesure le rendu, pas le code : elle liste ce qui dépasse réellement la
   largeur du document une fois tout posé. */
const PROBE = `<script>
addEventListener('load', function () {
  setTimeout(function () {
    var vw = document.documentElement.clientWidth, out = [];
    document.querySelectorAll('*').forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      if (r.right > vw + 1 || r.left < -1) {
        out.push(
          (el.tagName.toLowerCase())
          + (el.id ? '#' + el.id : '')
          + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).join('.') : '')
          + '  [' + Math.round(r.left) + ' → ' + Math.round(r.right) + ']'
        );
      }
    });
    var pre = document.createElement('pre');
    pre.id = 'AUDIT';
    pre.textContent = 'VIEWPORT ' + vw + ' | SCROLLWIDTH ' + document.documentElement.scrollWidth
      + '\\n' + (out.length ? out.slice(0, 40).join('\\n') : 'aucun débordement');
    document.body.appendChild(pre);
  }, 700);
});
</script>`;

const widths = process.argv[2] ? [Number(process.argv[2])] : [390, 820, 1440];

/* On récupère le HTML rendu par le serveur, on y injecte la sonde, et on charge le
   tout depuis un fichier local avec une <base> qui pointe sur le serveur : les
   feuilles de style et les polices de Next se chargent donc normalement.
   C'est le prix du passage à un rendu serveur — on ne peut plus auditer un fichier
   statique, et injecter du script dans une page distante demanderait le protocole
   DevTools, donc une dépendance. */
let html;
try {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  html = await res.text();
} catch (e) {
  console.error(`Impossible de charger ${url} — ${e.message}`);
  console.error('Le serveur tourne-t-il ? `npm run dev` dans un autre terminal.');
  process.exit(1);
}

const withBase = html.includes('<base ')
  ? html
  : html.replace(/<head([^>]*)>/i, `<head$1><base href="${BASE}/">`);

const tmp = resolve(ROOT, '_audit.html');
writeFileSync(tmp, withBase.replace('</body>', PROBE + '\n</body>'));

try {
  for (const w of widths) {
    const dom = execFileSync(CHROME, [
      '--headless=new', '--disable-gpu', '--force-device-scale-factor=1', '--virtual-time-budget=4000',
      `--window-size=${w},900`, '--dump-dom',
      'file:///' + tmp.replace(/\\/g, '/'),
    ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });

    const m = dom.match(/<pre id="AUDIT">([\s\S]*?)<\/pre>/);
    console.log(`\n████ ${w} px`);
    console.log(m ? m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') : '(sonde non exécutée)');
  }
} finally {
  if (existsSync(tmp)) unlinkSync(tmp);
}
