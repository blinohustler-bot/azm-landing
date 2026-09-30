#!/usr/bin/env node
// AZM — le panier combine, jusqu'au vrai panier Shopify.
//
// Ce test SORT sur le reseau : il depose reellement deux articles dans un panier
// anonyme de azmotorsport.ca pour verifier que le lien fait ce qu'on croit. Aucun
// achat, aucune donnee client, juste un panier qui expire tout seul.
//
/* Coche les pieces, lit le lien du recapitulatif, et VERIFIE le panier reel. */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const PORT = 9455;
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0; const fails = [];
const check = (n, c, d) => { if (c) { pass++; console.log(`  ok    ${n}`); } else { fails.push(n); console.log(`  ECHEC ${n}\n          ${d}`); } };

const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`,
  '--user-data-dir=' + fs.mkdtempSync(process.env.TEMP.replace(/\\/g, '/') + '/bd-'), 'about:blank'], { stdio: 'ignore' });
let t = null;
for (let i = 0; i < 40 && !t; i++) { await sleep(250); try { t = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((x) => x.type === 'page'); } catch { /* pas pret */ } }
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let id = 0; const pd = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pd.has(m.id)) { pd.get(m.id)(m.result); pd.delete(m.id); } };
const snd = (m, p = {}) => new Promise((r) => { const n = ++id; pd.set(n, r); ws.send(JSON.stringify({ id: n, method: m, params: p })); });
const ev = async (x) => (await snd('Runtime.evaluate', { expression: x, returnByValue: true }))?.result?.value;

await snd('Page.enable');
await snd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await snd('Page.navigate', { url: 'http://localhost:3000/?make=Audi&model=rs3&year=2022&step=results' });
await sleep(3200);

console.log('\n=== PANIER COMBINE ===');
check('deux cartes', (await ev(`document.querySelectorAll('.card').length`)) === 2, 'pas deux cartes');
check('une case par carte', (await ev(`document.querySelectorAll('.pick input').length`)) === 2, 'cases manquantes');
check('pas de recapitulatif avant de cocher', (await ev(`!document.querySelector('.bundle')`)), 'la barre est la trop tot');

/* On coche la premiere. */
await ev(`document.querySelectorAll('.pick input')[0].click()`); await sleep(700);
check('une case cochee fait apparaitre le recapitulatif', await ev(`!!document.querySelector('.bundle')`), 'pas de barre');
const un = await ev(`document.querySelector('.bundle .btn').getAttribute('href')`);
check('une seule variante dans le lien', (un.match(/:1/g) || []).length === 1, un.slice(0, 110));

/* On coche la seconde. */
await ev(`document.querySelectorAll('.pick input')[1].click()`); await sleep(700);
const deux = await ev(`document.querySelector('.bundle .btn').getAttribute('href')`);
const libelle = await ev(`document.querySelector('.bundle .btn').textContent`);
const total = await ev(`document.querySelector('.bundle__sum em').textContent`);
check('deux variantes dans le lien', (deux.match(/:1/g) || []).length === 2, deux.slice(0, 140));
check('le bouton dit combien', /2 together/.test(libelle), libelle);
console.log(`        total affiche : ${total}`);
console.log(`        lien : ${deux.slice(0, 120)}`);

/* Changer une variante doit changer le lien. */
await ev(`(() => { const s=document.querySelector('.opts select'); const a=[...s.options].find(o=>o.value!==s.value); const set=Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value').set; set.call(s,a.value); s.dispatchEvent(new Event('change',{bubbles:true})); })()`);
await sleep(800);
const apres = await ev(`document.querySelector('.bundle .btn').getAttribute('href')`);
const totalApres = await ev(`document.querySelector('.bundle__sum em').textContent`);
check('changer une option met a jour le panier combine', apres !== deux, 'le lien n a pas bouge');
console.log(`        total apres changement : ${totalApres}`);

/* Decocher doit retirer. */
await ev(`document.querySelectorAll('.pick input')[0].click()`); await sleep(600);
check('decocher retire la piece', (((await ev(`document.querySelector('.bundle .btn').getAttribute('href')`)) || '').match(/:1/g) || []).length === 1, 'la piece est restee');
await ev(`document.querySelectorAll('.pick input')[1].click()`); await sleep(600);
check('tout decocher fait disparaitre le recapitulatif', await ev(`!document.querySelector('.bundle')`), 'la barre est restee');

ws.close(); proc.kill();

/* ── la vraie preuve : le panier chez Shopify ─────────────────────────── */
console.log('\n=== VERIFICATION SUR LA VRAIE BOUTIQUE ===');
/* Par curl et pas par fetch : Shopify pose le cookie de panier au milieu d'une chaine
   de redirections, et un bocal reconstruit a la main en rate un maillon — mon premier
   essai rapportait un panier vide alors que le lien marchait. curl gere la chaine. */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36';
const jarFile = fs.mkdtempSync(process.env.TEMP.replace(/\\/g, '/') + '/jar-') + '/c.txt';
const curl = (args) => execFileSync('curl', ['-s', '-A', UA, '-c', jarFile, '-b', jarFile, ...args], { encoding: 'utf8' });
curl(['-L', '-o', process.platform === 'win32' ? 'NUL' : '/dev/null', deux]);
const cart = JSON.parse(curl(['https://azmotorsport.ca/cart.js']));
console.log(`  articles dans le panier : ${cart.item_count}`);
cart.items.forEach((i) => console.log(`   - ${i.title.slice(0, 58)}  ${(i.price / 100).toFixed(0)} $`));
console.log(`  total : ${(cart.total_price / 100).toFixed(0)} $`);
check('le lien depose bien DEUX articles chez Shopify', cart.item_count === 2, `${cart.item_count} article(s)`);

console.log(`\n=== BILAN ===\n  ${pass} passees, ${fails.length} echecs`);
process.exit(fails.length ? 1 : 0);
