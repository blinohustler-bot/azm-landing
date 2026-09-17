#!/usr/bin/env node
// Audit de mise en page dans Chrome headless : dit quels éléments débordent
// horizontalement, et à quelle largeur. Sans ça, un débordement mobile se
// diagnostique à l'œil et se corrige au hasard.
//
//   node audit.mjs           390, 820 et 1440 px
//   node audit.mjs 390       une seule largeur
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p));
if (!CHROME) { console.error('Ni Chrome ni Edge trouvé.'); process.exit(1); }

const PROBE = `
<script>
window.addEventListener('load', function () {
  setTimeout(function () {
    var vw = document.documentElement.clientWidth;
    var out = [];
    document.querySelectorAll('body *').forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      var over = Math.round(r.right - vw);
      if (over > 1) {
        var id = el.tagName.toLowerCase()
          + (el.id ? '#' + el.id : '')
          + (el.className && typeof el.className === 'string'
              ? '.' + el.className.trim().split(/\\s+/).join('.') : '');
        out.push(over + 'px  ' + id + '  [largeur ' + Math.round(r.width) + ']');
      }
    });
    var pre = document.createElement('pre');
    pre.id = 'AUDIT';
    pre.textContent = 'VIEWPORT ' + vw + ' | SCROLLWIDTH ' + document.documentElement.scrollWidth
      + '\\n' + (out.length ? out.join('\\n') : 'aucun débordement');
    document.body.appendChild(pre);
  }, 700);
});
</script>`;

const widths = process.argv[2] ? [Number(process.argv[2])] : [390, 820, 1440];
const src = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const tmp = resolve(ROOT, '_audit.html');
writeFileSync(tmp, src.replace('</body>', PROBE + '\n</body>'));

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
