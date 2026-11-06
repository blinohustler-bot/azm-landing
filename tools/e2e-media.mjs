#!/usr/bin/env node
// AZM — la carte produit : photos, vidéo, tags. Dans un vrai Chrome, à 390 px.
//
//   npm run build && npm start -- -p 3100
//   AZM_URL=http://localhost:3100 node tools/e2e-media.mjs
//
// Vérifie :
//   - le carrousel n'existe que sur une fiche à deux photos ou plus ;
//   - AUCUNE iframe avant le tap, et le tap crée l'iframe youtube-nocookie
//     avec playsinline ; « Close video » la retire ;
//   - les tags sur deux chars (des downpipes Race/High Flow, un échappement à
//     valves), le changement de tag au changement de variante, jamais plus de deux ;
//   - BUY NOW, la case « Add to cart » et la ligne de livraison gratuite, intacts.
// Les captures sortent dans tools/out/.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'tools/out');
fs.mkdirSync(OUT, { recursive: true });

const BASE = (process.env.AZM_URL || 'http://localhost:3100').replace(/\/$/, '');
const PORT = 9466;
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0; const fails = [];
const check = (n, c, d) => { if (c) { pass++; console.log(`  ok    ${n}`); } else { fails.push(n); console.log(`  ECHEC ${n}\n          ${d}`); } };

const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--disable-lcd-text',
  '--force-color-profile=srgb', '--autoplay-policy=no-user-gesture-required',
  `--remote-debugging-port=${PORT}`,
  '--user-data-dir=' + fs.mkdtempSync(process.env.TEMP.replace(/\\/g, '/') + '/md-'), 'about:blank'], { stdio: 'ignore' });

let t = null;
for (let i = 0; i < 40 && !t; i++) { await sleep(250); try { t = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((x) => x.type === 'page'); } catch { /* pas pret */ } }
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let id = 0; const pd = new Map();
const cspErrors = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pd.has(m.id)) { pd.get(m.id)(m.result); pd.delete(m.id); }
  if (m.method === 'Log.entryAdded' && /Content Security Policy/i.test(m.params.entry.text)) cspErrors.push(m.params.entry.text);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.args.some((a) => /Content Security Policy/i.test(a.value ?? ''))) cspErrors.push('console');
};
const snd = (m, p = {}) => new Promise((r) => { const n = ++id; pd.set(n, r); ws.send(JSON.stringify({ id: n, method: m, params: p })); });
const ev = async (x) => (await snd('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }))?.result?.value;
const goto = async (p) => { await snd('Page.navigate', { url: BASE + p }); await sleep(2600); };

/* Le vrai 390 px : Chrome headless clampe --window-size autour de 500 px sur cette
   machine (voir CLAUDE.md). On émule donc le téléphone par le protocole. */
await snd('Page.enable');
await snd('Log.enable');
await snd('Runtime.enable');
await snd('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await snd('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

/* Capture d'une carte entière, même plus haute que l'écran. */
async function shotCard(index, file) {
  /* La barre du haut est collante : on laisse 220 px au-dessus de la carte pour
     qu'elle ne la recouvre pas sur la capture. */
  await ev(`window.scrollTo(0, document.querySelectorAll('.card')[${index}].getBoundingClientRect().top + scrollY - 220)`);
  await sleep(900);
  const r = await ev(`(() => { const b=document.querySelectorAll('.card')[${index}].getBoundingClientRect(); return {x:b.left+scrollX, y:b.top+scrollY, w:b.width, h:b.height}; })()`);
  const res = await snd('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true,
    clip: { x: r.x, y: r.y, width: r.w, height: r.h, scale: 1 }
  });
  fs.writeFileSync(`${OUT}/${file}`, Buffer.from(res.data, 'base64'));
  console.log(`        capture : tools/out/${file}`);
}

const setOption = (cardIdx, match) => ev(`(() => {
  const card = document.querySelectorAll('.card')[${cardIdx}];
  for (const s of card.querySelectorAll('.opts select')) {
    const o = [...s.options].find((x) => ${match}.test(x.value));
    if (!o) continue;
    const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    set.call(s, o.value); s.dispatchEvent(new Event('change', { bubbles: true }));
    return o.value;
  }
  return null;
})()`);
const chips = (i) => ev(`[...document.querySelectorAll('.card')[${i}].querySelectorAll('.chip')].map((c) => c.textContent)`);
const allChipCounts = () => ev(`[...document.querySelectorAll('.card')].map((c) => c.querySelectorAll('.chip').length)`);
const ALLOWED = ['Best seller', 'Top rated', 'Max power', 'Daily friendly', 'Ships free'];

/* ── BMW M3 G80 : downpipes (6 photos) + échappement à valves (6 photos) ───── */
console.log('\n=== BMW M3 G80 ===');
await goto('/?make=BMW&model=m3&year=2021&step=results');

const cards = await ev(`[...document.querySelectorAll('.card')].map((c) => ({
  title: c.querySelector('h3').textContent,
  gallery: !!c.querySelector('.gallery'),
  slides: c.querySelectorAll('.gallery__slide').length,
  hear: c.querySelector('.hear')?.textContent ?? null
}))`);
console.log(cards.map((c) => `        ${c.title} | photos ${c.slides} | ${c.hear ?? 'pas de video'}`).join('\n'));
const dp = cards.findIndex((c) => /Downpipe/i.test(c.title));
const ex = cards.findIndex((c) => /Exhaust/i.test(c.title));
check('deux cartes (downpipes + échappement)', dp >= 0 && ex >= 0, JSON.stringify(cards));
check('carrousel présent sur une fiche à 6 photos', cards[dp].gallery && cards[dp].slides === 6, JSON.stringify(cards[dp]));
check('compteur « 1 / 6 »', (await ev(`document.querySelectorAll('.card')[${dp}].querySelector('.gallery__count').textContent`)) === '1 / 6', 'compteur absent');
check('flèches cachées au doigt (pointeur grossier)', (await ev(`getComputedStyle(document.querySelectorAll('.card')[${dp}].querySelector('.gallery__arrow--next')).display`)) === 'none', 'flèches visibles');
check('1re photo de la 1re carte prioritaire, les autres paresseuses',
  await ev(`(() => { const im=[...document.querySelectorAll('.card')[0].querySelectorAll('.gallery__slide img')]; return im[0].getAttribute('loading')!=='lazy' && im.slice(1).every((i)=>i.getAttribute('loading')==='lazy'); })()`), 'chargement');

/* Défilement au doigt : le compteur suit. */
await ev(`(() => { const t=document.querySelectorAll('.card')[${dp}].querySelector('.gallery__track'); t.scrollTo({left:t.clientWidth*2}); })()`);
await sleep(500);
check('défiler met le compteur à jour', (await ev(`document.querySelectorAll('.card')[${dp}].querySelector('.gallery__count').textContent`)) === '3 / 6', 'compteur figé');
await ev(`document.querySelectorAll('.card')[${dp}].querySelector('.gallery__track').scrollTo({left:0})`);

check('la vidéo nomme le char du visiteur (G80 M3)', /^Hear it on a G80 M3$/.test((cards[dp].hear || '').trim()), cards[dp].hear);

/* Tags qui suivent la variante. */
await setOption(dp, /Race/); await sleep(400);
const race = await chips(dp);
await setOption(dp, /High Flow/); await sleep(400);
const hf = await chips(dp);
console.log(`        downpipes Race : ${JSON.stringify(race)} | High Flow : ${JSON.stringify(hf)}`);
check('Race (catless) → Max power', race.includes('Max power') && !race.includes('Daily friendly'), JSON.stringify(race));
check('High Flow (catted) → Daily friendly', hf.includes('Daily friendly') && !hf.includes('Max power'), JSON.stringify(hf));
await setOption(dp, /Race/); await sleep(300);

const exTags = await chips(ex);
console.log(`        échappement : ${JSON.stringify(exTags)}`);
check('échappement à valves → Daily friendly', exTags.includes('Daily friendly'), JSON.stringify(exTags));
/* L'échappement est noté 5.0 et coûte plus de 1 000 $ : trois tags vrais, deux
   affichés, et c'est « Ships free » qui cède — il a la priorité la plus basse. */
check('priorité : Top rated + Daily friendly, Ships free coupé', JSON.stringify(exTags) === '["Top rated","Daily friendly"]', JSON.stringify(exTags));
const counts = await allChipCounts();
check('jamais plus de 2 tags', counts.every((n) => n <= 2), JSON.stringify(counts));
check('copie exacte des tags', (await ev(`[...document.querySelectorAll('.chip')].map(c=>c.textContent)`)).every((x) => ALLOWED.includes(x)), 'libellé inconnu');

/* Rien n'a cassé autour. */
check('BUY NOW sur chaque carte', (await ev(`document.querySelectorAll('.card .card__actions .btn').length`)) === cards.length, 'bouton manquant');
check('lien BUY NOW vers le panier Shopify', /\/cart\/\d+:1\?/.test(await ev(`document.querySelectorAll('.card .card__actions .btn')[${dp}].getAttribute('href')`)), 'lien');
check('case « Add to cart » présente', (await ev(`document.querySelectorAll('.pick input').length`)) === cards.length, 'cases');
check('ligne de livraison gratuite présente', await ev(`[...document.querySelectorAll('.card')].every(c=>/Free shipping/.test(c.querySelector('.assure').textContent))`), 'ligne absente');
await ev(`document.querySelectorAll('.pick input')[0].click()`); await sleep(500);
check('cocher fait toujours apparaître la barre .bundle', await ev(`!!document.querySelector('.bundle')`), 'pas de barre');
await ev(`document.querySelectorAll('.pick input')[0].click()`); await sleep(400);

await shotCard(dp, 'card-carousel-tags-390.png');

/* ── la vidéo ─────────────────────────────────────────────────────────────── */
console.log('\n=== VIDEO ===');
check('aucune iframe YouTube au chargement', (await ev(`document.querySelectorAll('iframe[src*="youtube"]').length`)) === 0, 'iframe présente avant le tap');
const ytReq = await ev(`performance.getEntriesByType('resource').filter(r=>/youtube|ytimg|googlevideo/.test(r.name)).length`);
check('aucune requête YouTube au chargement', ytReq === 0, `${ytReq} requêtes`);

/* Un vrai tap (événements tactiles), pas un clic JavaScript. */
await ev(`document.querySelectorAll('.card')[${dp}].querySelector('.hear').scrollIntoView({block:'center'})`);
await sleep(300);
const b = await ev(`(() => { const r=document.querySelectorAll('.card')[${dp}].querySelector('.hear').getBoundingClientRect(); return {x:r.left+r.width/2, y:r.top+r.height/2}; })()`);
await snd('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x, y: b.y }] });
await snd('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await sleep(2500);
const src = await ev(`document.querySelectorAll('.card')[${dp}].querySelector('.player iframe')?.getAttribute('src') ?? ''`);
console.log(`        iframe : ${src}`);
check('le tap crée l’iframe youtube-nocookie', src.startsWith('https://www.youtube-nocookie.com/embed/'), src);
check('playsinline=1 et rel=0', /playsinline=1/.test(src) && /rel=0/.test(src), src);
check('une seule iframe YouTube sur la page', (await ev(`document.querySelectorAll('iframe[src*="youtube"]').length`)) === 1, 'plusieurs');
check('la CSP n’a rien bloqué', cspErrors.length === 0, cspErrors.join(' | '));
await shotCard(dp, 'card-video-open-390.png');

await ev(`document.querySelectorAll('.card')[${dp}].querySelector('.player__close').click()`);
await sleep(400);
check('« Close video » retire l’iframe', (await ev(`document.querySelectorAll('iframe[src*="youtube"]').length`)) === 0, 'iframe restée');
check('le bouton revient', await ev(`!!document.querySelectorAll('.card')[${dp}].querySelector('.hear')`), 'bouton absent');

/* ── une fiche à une seule photo ──────────────────────────────────────────── */
console.log('\n=== E63 W213 (une photo) ===');
await goto('/?make=Mercedes-AMG&model=e63&step=results');
const one = await ev(`(() => { const c=document.querySelector('.card'); return { gallery: !!c.querySelector('.gallery'), img: c.querySelectorAll('.card__media img').length, hear: c.querySelector('.hear')?.textContent ?? null }; })()`);
check('pas de carrousel avec une seule photo', !one.gallery && one.img === 1, JSON.stringify(one));
check('vidéo E63S W213', /E63S W213/.test(one.hear || ''), one.hear);

/* ── un char sans vidéo pour son modèle ───────────────────────────────────── */
console.log('\n=== Audi RSQ8 (la vidéo est une SQ8) ===');
await goto('/?make=Audi&model=rsq8&step=results');
check('aucun bouton vidéo sur une RSQ8', (await ev(`document.querySelectorAll('.hear').length`)) === 0, 'vidéo SQ8 montrée à une RSQ8');
check('jamais plus de 2 tags', (await allChipCounts()).every((n) => n <= 2), 'trop de tags');

/* ── tour des écrans : jamais plus de 2 tags, aucune iframe avant tap ─────── */
console.log('\n=== TOUR ===');
const screens = [
  '/?make=Porsche&model=gt3&year=2022&step=results',
  '/?make=McLaren&model=720s&step=results',
  '/?make=Lamborghini&model=urus&step=results',
  '/?make=Audi&model=rs7&step=results'
];
for (const s of screens) {
  await goto(s);
  const n = await allChipCounts();
  const ifr = await ev(`document.querySelectorAll('iframe[src*="youtube"]').length`);
  const hear = await ev(`[...document.querySelectorAll('.hear')].map(h=>h.textContent)`);
  console.log(`        ${s.padEnd(52)} tags ${JSON.stringify(n)} ${JSON.stringify(hear)}`);
  check(`${s} : ≤ 2 tags, 0 iframe`, n.every((x) => x <= 2) && ifr === 0, JSON.stringify({ n, ifr }));
}

/* « Ships free » sur une carte sans note : la Corvette C8 (aucun avis, plus de 1 000 $). */
await goto('/?make=Corvette&model=c8&step=results');
const vette = await ev(`[...document.querySelectorAll('.card')].map((c) => [...c.querySelectorAll('.chip')].map((x) => x.textContent))`);
console.log(`        Corvette C8 : ${JSON.stringify(vette)}`);
check('Ships free affiché quand la place est libre', vette.some((c) => c.includes('Ships free')), JSON.stringify(vette));

ws.close(); proc.kill();
console.log(`\n=== BILAN ===\n  ${pass} passees, ${fails.length} echecs`);
process.exit(fails.length ? 1 : 0);
