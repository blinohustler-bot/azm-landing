#!/usr/bin/env node
// AZM — ce que la souris ne teste pas : le tactile reel et le visiteur connu.
//
/* Deux choses que la souris ne teste pas :
   - le TACTILE reel (Input.dispatchTouchEvent), pas un clic souris deguise ;
   - le visiteur DEJA CONNU, qui doit sauter le formulaire grace au cookie. */
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const BASE = 'http://localhost:3000';
const PORT = 9412;
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0; const fails = [];
const check = (n, c, d) => { if (c) { pass++; console.log(`  ok    ${n}`); } else { fails.push(n); console.log(`  ECHEC ${n}\n          ${d}`); } };

const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`,
  '--user-data-dir=' + fs.mkdtempSync(process.env.TEMP.replace(/\\/g, '/') + '/tc-'), 'about:blank'], { stdio: 'ignore' });

let t = null;
for (let i = 0; i < 40 && !t; i++) { await sleep(250); try { t = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((x) => x.type === 'page'); } catch { /* pas pret */ } }
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let id = 0; const pd = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pd.has(m.id)) { pd.get(m.id)(m.result); pd.delete(m.id); } };
const snd = (m, p = {}) => new Promise((r) => { const n = ++id; pd.set(n, r); ws.send(JSON.stringify({ id: n, method: m, params: p })); });
const ev = async (x) => (await snd('Runtime.evaluate', { expression: x, returnByValue: true }))?.result?.value;
const goto = async (p) => { await snd('Page.navigate', { url: BASE + p }); await sleep(2200); };

await snd('Page.enable');
await snd('Emulation.setDeviceMetricsOverride', { width: 390, height: 780, deviceScaleFactor: 2, mobile: true });
await snd('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

console.log('\n=== TACTILE REEL (390 px, pointeur grossier) ===');
await goto('/');

check('le navigateur se declare tactile', await ev('navigator.maxTouchPoints > 0'), 'maxTouchPoints = 0');
check('la regle hover:none s applique', await ev(`matchMedia('(hover: none)').matches`), 'le media hover:none ne matche pas');

/* Taille de cible tactile : 44x44 est le minimum recommande. */
const petites = await ev(`JSON.stringify([...document.querySelectorAll('a,button')]
  .filter(e => e.offsetParent !== null)
  .map(e => ({ t: (e.textContent||e.getAttribute('aria-label')||'?').trim().slice(0,28), w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height) }))
  .filter(o => o.w > 0 && (o.w < 44 || o.h < 44)))`);
const trop = JSON.parse(petites);
check('toutes les cibles tactiles font au moins 44 px', trop.length === 0, trop.map((o) => `${o.t} ${o.w}x${o.h}`).join(' | '));

/* Tap reel sur une tuile de marque. */
const box = JSON.parse(await ev(`(() => { const e=document.querySelector('.brand-card[data-brand="porsche"]'); e.scrollIntoView({block:'center'}); const b=e.getBoundingClientRect(); return JSON.stringify({x:Math.round(b.left+b.width/2), y:Math.round(b.top+b.height/2)}); })()`));
await snd('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x, y: box.y }] });
await snd('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await sleep(1600);
check('un tap sur une tuile navigue', (await ev('location.search')).includes('make=Porsche'), `url = ${await ev('location.search')}`);

/* Balayage du rail d avis, au doigt. */
await goto('/');
const avant = await ev(`(() => { const r=document.querySelector('.rail'); r.scrollIntoView({block:'center'}); return r.scrollLeft; })()`);
const rb = JSON.parse(await ev(`(() => { const b=document.querySelector('.rail').getBoundingClientRect(); return JSON.stringify({x:Math.round(b.left+b.width*0.8), y:Math.round(b.top+b.height*0.3)}); })()`));
await snd('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: rb.x, y: rb.y }] });
for (let i = 1; i <= 8; i++) {
  await snd('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: rb.x - i * 28, y: rb.y }] });
  await sleep(40);
}
await snd('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await sleep(1400);
const apres = await ev(`document.querySelector('.rail').scrollLeft`);
check('le rail se balaie au doigt', apres > avant, `scrollLeft ${avant} -> ${apres}`);

/* La page elle-meme ne doit pas partir de travers pendant le balayage. */
check('la page ne defile pas horizontalement', (await ev('document.documentElement.scrollLeft')) === 0, 'la page a bouge en X');

console.log('\n=== VISITEUR DEJA CONNU (cookie) ===');
await snd('Network.enable');
await snd('Network.setCookie', { name: 'azm_lead', value: '1', domain: 'localhost', path: '/' });
const nom = await ev(`document.cookie`);
await goto('/?make=BMW&model=m3&year=2021');
const surResultats = await ev(`!!document.querySelector('.card')`);
check('un visiteur connu saute le formulaire', surResultats, `cookies vus : ${nom} — pas de carte produit affichee`);

console.log('\n=== BILAN ===');
console.log(`  ${pass} passees, ${fails.length} echecs`);
ws.close(); proc.kill();
process.exit(fails.length ? 1 : 0);
