#!/usr/bin/env node
// AZM — le chat Tyler sur l'écran des pièces, contre le faux Tyler (tools/tyler-stub.mjs).
//
//   node tools/tyler-stub.mjs     (le script le lance lui-même s'il ne répond pas)
//   TYLER_URL=http://localhost:4010 TYLER_WEBCHAT_SECRET=stub TYLER_CHAT_FORCE=1 \
//   CHAT_TOKEN_SECRET=e2e-chat-secret npm start
//   node tools/e2e-chat.mjs
//
/* Au protocole DevTools, à 390 px par Emulation.setDeviceMetricsOverride (Chrome
 * headless de cette machine clampe la fenêtre autour de 500 px : voir CLAUDE.md).
 * Les clics sont de vrais clics souris au centre de l'élément, comme tools/e2e.mjs :
 * un bouton recouvert répondrait à element.click() et pas à un vrai doigt.
 *
 * Le cookie azm_chat est signé ici avec CHAT_TOKEN_SECRET (défaut : e2e-chat-secret),
 * qui doit être le même que celui du serveur. Le mode du faux Tyler (échec, tour long,
 * silence) se règle par GET /__mode ; GET /__log rend les tours reçus avec leurs heures.
 *
 * Les captures sortent dans tools/out/ (ignoré par git). Durée : environ deux minutes,
 * dont 2 × 16 s d'attente de la bulle et 27 s de silence.
 */
import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'http://localhost:3000';
const STUB = 'http://localhost:4010';
const SECRET = process.env.CHAT_TOKEN_SECRET || 'e2e-chat-secret';
const PAGE = '/?make=BMW&model=m3&year=2021&step=results';
const W = 390, H = 844;
const PORT = 9471;
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0;
const fails = [];
const jsErrors = [];
const check = (n, c, d) => {
  if (c) { pass++; console.log(`  ok    ${n}`); } else { fails.push(n); console.log(`  ECHEC ${n}\n          ${d}`); }
};

/* ── le jeton, signé comme lib/chatToken.ts ──────────────────────────────── */
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64url');
function token(contactId) {
  const payload = `${b64(contactId)}.${Math.floor(Date.now() / 1000) + 3600}`;
  return `${payload}.${createHmac('sha256', SECRET).update(payload).digest('base64url')}`;
}
const TOKEN = token('e2e-contact');

/* ── le faux Tyler : on le lance s'il ne répond pas ──────────────────────── */
let stubProc = null;
const stub = async (p) => (await fetch(STUB + p)).json();
try { await stub('/__mode'); } catch {
  stubProc = spawn(process.execPath, [path.join(HERE, 'tyler-stub.mjs')], { stdio: 'ignore' });
  for (let i = 0; i < 20; i++) { await sleep(250); try { await stub('/__mode'); break; } catch { /* pas prêt */ } }
}

/* ── le serveur doit avoir le chat allumé et le même secret ──────────────── */
try {
  const r = await fetch(`${BASE}/api/chat/status`, { headers: { cookie: `azm_chat=${TOKEN}` } });
  const d = await r.json().catch(() => ({}));
  if (!d.enabled) throw new Error(`status ${r.status} ${JSON.stringify(d)}`);
} catch (e) {
  console.error(`\nLe serveur ne sert pas le chat (${e.message}).\nLancer : TYLER_URL=${STUB} TYLER_WEBCHAT_SECRET=stub TYLER_CHAT_FORCE=1 CHAT_TOKEN_SECRET=${SECRET} npm start\n`);
  stubProc?.kill();
  process.exit(1);
}

/* ── Chrome ──────────────────────────────────────────────────────────────── */
const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--disable-lcd-text',
  '--force-color-profile=srgb', `--remote-debugging-port=${PORT}`,
  '--user-data-dir=' + fs.mkdtempSync(process.env.TEMP.replace(/\\/g, '/') + '/chat-'), 'about:blank'], { stdio: 'ignore' });
let t = null;
for (let i = 0; i < 40 && !t; i++) { await sleep(250); try { t = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((x) => x.type === 'page'); } catch { /* pas prêt */ } }
if (!t) { proc.kill(); stubProc?.kill(); throw new Error('Chrome injoignable'); }
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let id = 0; const pd = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pd.has(m.id)) { pd.get(m.id)(m.result ?? m); pd.delete(m.id); return; }
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    jsErrors.push('EXCEPTION ' + (d.exception?.description || d.text || '').slice(0, 180));
  }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    jsErrors.push('CONSOLE ' + m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 180));
  }
};
const snd = (m, p = {}) => new Promise((r) => { const n = ++id; pd.set(n, r); ws.send(JSON.stringify({ id: n, method: m, params: p })); });
const ev = async (x) => {
  const r = await snd('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true });
  if (r?.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 240));
  return r?.result?.value;
};
const q = (s) => JSON.stringify(s);
const exists = (sel) => ev(`!!document.querySelector(${q(sel)})`);
const text = (sel) => ev(`(document.querySelector(${q(sel)})||{}).textContent || ''`);
async function waitFor(expr, ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await ev(expr)) return true; await sleep(100); }
  return false;
}

/* Vrai clic au centre de l'élément ; échoue si un autre élément le recouvre. */
async function click(sel) {
  const box = await ev(`(() => {
    const e = document.querySelector(${q(sel)});
    if (!e) return null;
    const b = e.getBoundingClientRect();
    if (!b.width || !b.height) return 'invisible';
    const x = Math.round(b.left + b.width / 2), y = Math.round(b.top + b.height / 2);
    const top = document.elementFromPoint(x, y);
    return JSON.stringify({ x, y, covered: !(e === top || e.contains(top)) });
  })()`);
  if (!box || box === 'invisible') return `${sel}: ${box ?? 'introuvable'}`;
  const b = JSON.parse(box);
  if (b.covered) return `${sel}: recouvert`;
  for (const type of ['mousePressed', 'mouseReleased']) {
    await snd('Input.dispatchMouseEvent', { type, x: b.x, y: b.y, button: 'left', clickCount: 1 });
  }
  return true;
}
async function type(sel, value) {
  await ev(`document.querySelector(${q(sel)}).focus()`);
  for (const ch of value) await snd('Input.dispatchKeyEvent', { type: 'char', text: ch });
}
async function shot(name) {
  fs.mkdirSync(OUT, { recursive: true });
  await sleep(700); // les animations d'entrée finies
  const r = await snd('Page.captureScreenshot', { format: 'png' });
  const f = path.join(OUT, name);
  fs.writeFileSync(f, Buffer.from(r.data, 'base64'));
  console.log(`        capture : ${f}`);
}
const goto = async (p = PAGE) => { await snd('Page.navigate', { url: BASE + p }); await sleep(2500); };
const clarityCalls = () => ev(`(window.__clarity || []).filter((c) => c[1] === 'chat').map((c) => c[2])`);
const setCookie = () => snd('Network.setCookie', { name: 'azm_chat', value: TOKEN, url: BASE, httpOnly: true, sameSite: 'Lax' });

await snd('Runtime.enable');
await snd('Page.enable');
await snd('Network.enable');
/* Le vrai script Clarity remplacerait le faux ci-dessous : il n'est pas chargé. */
await snd('Network.setBlockedURLs', { urls: ['*clarity.ms*'] });
await snd('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: true });
/* Clarity enregistré au lieu d'être chargé : on lit ce que le widget lui envoie. Le
   script de la page fait `clarity = clarity || …`, il garde donc ce faux-ci. */
await snd('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
  const calls = []; window.__clarity = calls;
  const rec = function () { calls.push([...arguments]); };
  rec.q = [];
  Object.defineProperty(window, 'clarity', { configurable: false, get() { return rec; }, set() {} });
})()` });

/* ── 1. sans jeton, pas de widget ────────────────────────────────────────── */
console.log('\n=== no token, no widget ===');
await snd('Network.clearBrowserCookies');
await stub('/__mode');
jsErrors.length = 0;
await goto();
await sleep(2000);
check('les pièces sont affichées', (await ev(`document.querySelectorAll('.card').length`)) > 0, 'aucune carte');
check('aucun .tchat dans le DOM', !(await exists('.tchat')), 'le widget est là sans jeton');
check('console sans erreur', jsErrors.length === 0, jsErrors.join(' | '));

/* ── 2. la bulle après 15 s, une fois par session ────────────────────────── */
console.log('\n=== bubble after 15s ===');
await setCookie();
await ev('sessionStorage.clear()');
jsErrors.length = 0;
const t0 = Date.now();
await goto();
check('le bouton flottant est là', await waitFor(`!!document.querySelector('.tchat__fab')`, 5000), 'pas de .tchat__fab');
check('le bouton dit « 💬 Ask Tyler »', (await text('.tchat__fab')).trim() === '💬 Ask Tyler', await text('.tchat__fab'));
check('pas de bulle avant 15 s', !(await exists('.tchat__bubble')), 'bulle trop tôt');
await sleep(Math.max(0, 16_000 - (Date.now() - t0)));
check('la bulle est visible après 16 s', await exists('.tchat__bubble'), 'pas de bulle');
const greet = (await text('.tchat__bubble p')).trim();
check('texte exact de la bulle', greet === 'Hey Alex, need a hand picking the right parts for your M3?', greet);
check('boutons « Yeah, help me » / « I\'m good »',
  (await text('.tchat__yes')) === 'Yeah, help me' && (await text('.tchat__no')) === "I'm good",
  `${await text('.tchat__yes')} / ${await text('.tchat__no')}`);
check('✕ porte aria-label « Dismiss »', (await ev(`document.querySelector('.tchat__x').getAttribute('aria-label')`)) === 'Dismiss', 'aria-label');
const bw = await ev(`Math.round(document.querySelector('.tchat__bubble').getBoundingClientRect().width)`);
check('bulle ~205 px de large', bw >= 195 && bw <= 210, `${bw} px`);
const bh = await ev(`Math.round(document.querySelector('.tchat__bubble').getBoundingClientRect().height)`);
check('bulle ≤ 90 px de haut', bh <= 90, `${bh} px`);
check('les deux choix sur une ligne', await ev(`document.querySelector('.tchat__yes').getBoundingClientRect().top === document.querySelector('.tchat__no').getBoundingClientRect().top`), 'choix sur deux lignes');
check('la bulle ne couvre pas le titre de la carte visible', await ev(`(() => {
  const d = document.querySelector('.tchat__bubble').getBoundingClientRect();
  return [...document.querySelectorAll('.card h3')].every((h) => { const r = h.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return true;
    return !(r.bottom > d.top && r.top < d.bottom && r.right > d.left && r.left < d.right); });
})()`), 'recouvrement du titre');
check('le bouton flottant est une pilule lime', await ev(`(() => { const s = getComputedStyle(document.querySelector('.tchat__fab'));
  return s.backgroundColor === 'rgb(206, 254, 1)' && s.color === 'rgb(0, 0, 0)' && parseFloat(s.borderTopLeftRadius) >= 20; })()`), 'style du bouton');
check('la bulle ne couvre aucun « Buy now » visible', await ev(`(() => {
  const d = document.querySelector('.tchat__dock').getBoundingClientRect();
  return [...document.querySelectorAll('.card__actions .btn')].every((b) => { const r = b.getBoundingClientRect();
    return !(r.bottom > d.top && r.top < d.bottom && r.right > d.left && r.left < d.right); });
})()`), 'recouvrement');
check('Clarity : bubble_shown', (await clarityCalls()).includes('bubble_shown'), JSON.stringify(await clarityCalls()));
await shot('chat-bubble-390.png');
const r1 = await click('.tchat__x');
check('clic ✕', r1 === true, r1);
await sleep(300);
check('la bulle a disparu', !(await exists('.tchat__bubble')), 'toujours là');
await goto();
await sleep(16_500 - 2500);
check('rechargée : pas de nouvelle bulle', !(await exists('.tchat__bubble')), 'bulle réapparue');
check('console sans erreur', jsErrors.length === 0, jsErrors.join(' | '));

/* ── 3. ouvrir, la réponse, la proposition, l'appel ──────────────────────── */
console.log('\n=== open and answer ===');
await stub('/__mode?delay=900');
const r2 = await click('.tchat__fab');
check('clic « 💬 Ask Tyler »', r2 === true, r2);
check('le panneau est un dialog « Chat with Tyler »', await waitFor(`document.querySelector('[role=dialog]')?.getAttribute('aria-label') === 'Chat with Tyler'`, 2000), 'pas de dialog');
check('en-tête « Tyler · AZ Motorsport » + Online',
  (await text('.tchat__head b')) === 'Tyler · AZ Motorsport' && (await text('.tchat__online')) === 'Online',
  `${await text('.tchat__head b')} / ${await text('.tchat__online')}`);
check('« typing… » pendant le tour', await waitFor(`document.querySelector('.tchat__typing')?.textContent === 'typing…'`, 4000), 'pas d\'indicateur');
check('puis le message du faux Tyler', await waitFor(`[...document.querySelectorAll('.tchat__msg')].some((m) => m.textContent === "Quick check, it's a 2021 M3 you're working with?")`, 6000), 'message absent');
check('l\'indicateur disparaît', !(await exists('.tchat__typing')), 'typing reste');
check('le focus est dans le champ à l\'ouverture', await ev(`document.activeElement === document.querySelector('.tchat__form input')`), await ev('document.activeElement?.className'));
check('la zone des messages est aria-live polite', (await ev(`document.querySelector('.tchat__log').getAttribute('aria-live')`)) === 'polite', 'aria-live');
check('Clarity : open', (await clarityCalls()).includes('open'), JSON.stringify(await clarityCalls()));
check('la page ne défile plus sous la feuille', await ev(`getComputedStyle(document.body).overflow === 'hidden' && getComputedStyle(document.documentElement).overflow === 'hidden'`), 'pas de verrou');
check('le fond assombri bloque le geste', await ev(`getComputedStyle(document.querySelector('.tchat__scrim')).touchAction === 'none'`), 'touch-action');
const turns1 = await stub('/__log');
check('le tour d\'ouverture part avec text null', turns1.length === 1 && turns1[0].text === null, JSON.stringify(turns1));

await type('.tchat__form input', 'Street car, daily driver');
const r3 = await click('.tchat__form button');
check('envoyer', r3 === true, r3);
check('la carte de proposition arrive', await waitFor(`!!document.querySelector('.tchat__card')`, 6000), 'pas de carte');
const card = await text('.tchat__card');
check('produit + option sur la carte', /BMW M3 \/ M4 G80 Downpipes High Flow \(catted\)/.test(card), card);
check('prix $1,149 tiré de la proposition', (await text('.tchat__price b')) === '$1,149', await text('.tchat__price b'));
check('« ships free » (≥ 1 000 $)', (await text('.tchat__price span')) === 'ships free', await text('.tchat__price span'));
check('bouton CHECKOUT', (await text('.tchat__card .btn')) === 'CHECKOUT', await text('.tchat__card .btn'));
check('lien « Grab a quick call »', (await text('.tchat__call')) === 'Want to talk it through with Tommy first? Grab a quick call', await text('.tchat__call'));
check('l\'adresse dans le texte de Tyler est un lien http(s), sans le point final',
  (await ev(`[...document.querySelectorAll('.tchat__msg a')].map((a) => a.getAttribute('href')).join()`)) === 'https://azmotorsport.ca/products/bmw-m3-downpipes',
  await ev(`[...document.querySelectorAll('.tchat__msg a')].map((a) => a.getAttribute('href')).join()`));
check('Clarity : msg', (await clarityCalls()).includes('msg'), JSON.stringify(await clarityCalls()));
await shot('chat-proposal-390.png');

/* CHECKOUT : même onglet, lien panier + withCheckout. On bloque la navigation pour lire
   le lien réellement suivi (les pixels de la page passent avant nous). */
await ev(`document.addEventListener('click', (e) => { const a = e.target.closest('.tchat__card .btn'); if (a) { e.preventDefault(); window.__followed = { href: a.href, target: a.target }; } })`);
await ev(`document.querySelector('.tchat__card .btn').scrollIntoView({ block: 'center' })`);
const r4 = await click('.tchat__card .btn');
check('clic CHECKOUT', r4 === true, r4);
await sleep(300);
const followed = await ev('window.__followed');
check('CHECKOUT suit le lien de la proposition, même onglet', !!followed && followed.href.startsWith('https://azmotorsport.ca/cart/4321:1?') && !followed.target, JSON.stringify(followed));
check('CHECKOUT passe par withCheckout (attributes[source])', !!followed && /attributes%5Bsource%5D=fitment_lp/.test(followed.href), followed?.href);
check('Clarity : checkout', (await clarityCalls()).includes('checkout'), JSON.stringify(await clarityCalls()));

await ev(`document.querySelector('.tchat__call').scrollIntoView({ block: 'center' })`);
const r5 = await click('.tchat__call');
check('clic « Grab a quick call »', r5 === true, r5);
check('envoie « I\'d rather talk to Tommy »', await waitFor(`[...document.querySelectorAll('.tchat__msg--me')].some((m) => m.textContent === "I'd rather talk to Tommy")`, 2000), 'message absent');
check('Clarity : call', (await clarityCalls()).includes('call'), JSON.stringify(await clarityCalls()));
check('« Grab a quick call » désactivé après le premier tap', await ev(`document.querySelector('.tchat__call').disabled`), 'toujours actif');
check('les créneaux arrivent', await waitFor(`document.querySelectorAll('.tchat__slots button').length === 2`, 6000), 'pas de créneaux');
const r6 = await click('.tchat__slots button');
check('clic sur un créneau', r6 === true, r6);
check('le créneau part comme message', await waitFor(`[...document.querySelectorAll('.tchat__msg--me')].some((m) => m.textContent === 'Tomorrow 10:00')`, 2000), 'pas envoyé');
for (let i = 0; i < 40 && (await stub('/__log')).length < 4; i++) await sleep(150);
const turns2 = await stub('/__log');
check('le faux Tyler a reçu le créneau', turns2.at(-1)?.text === 'Tomorrow 10:00', JSON.stringify(turns2.map((x) => x.text)));
check('console sans erreur', jsErrors.length === 0, jsErrors.join(' | '));

/* ── 4. un message tapé pendant un tour attend la fin du tour ────────────── */
console.log('\n=== queue during a turn ===');
await stub('/__mode?delay=3000');
await goto();
await click('.tchat__fab');
await sleep(600);
check('le champ reste utilisable pendant le tour', await ev(`!document.querySelector('.tchat__form input').disabled`), 'champ désactivé');
await type('.tchat__form input', 'second message');
await click('.tchat__form button');
check('le message s\'affiche tout de suite', await exists('.tchat__msg--me'), 'pas de bulle');
await sleep(500);
check('pas de second tour pendant le premier', (await stub('/__log')).length === 1, JSON.stringify(await stub('/__log')));
await waitFor(`document.querySelectorAll('.tchat__msg:not(.tchat__msg--me)').length >= 2`, 12_000);
const tq = await stub('/__log');
check('le second tour part après le done du premier',
  tq.length === 2 && tq[0].text === null && tq[1].text === 'second message' && tq[0].end !== null && tq[1].start >= tq[0].end,
  JSON.stringify(tq));

/* ── 5. dialog : focus, Échap, retour du focus ───────────────────────────── */
console.log('\n=== dialog a11y ===');
await snd('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
await snd('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
await sleep(300);
check('Échap ferme le panneau', !(await exists('[role=dialog]')), 'toujours ouvert');
check('le focus revient au bouton', await ev(`document.activeElement === document.querySelector('.tchat__fab')`), await ev('document.activeElement?.className'));
await click('.tchat__fab');
await sleep(400);
check('rouvert : le focus revient au champ', await ev(`document.activeElement === document.querySelector('.tchat__form input')`), await ev('document.activeElement?.className'));
check('rouvrir garde l\'historique sans nouveau tour', (await ev(`document.querySelectorAll('.tchat__msg').length`)) >= 3 && (await stub('/__log')).length === 2, 'historique perdu ou tour relancé');
await click('.tchat__close');
await sleep(300);
check('✕ ferme aussi, focus au bouton', !(await exists('[role=dialog]')) && await ev(`document.activeElement === document.querySelector('.tchat__fab')`), 'fermeture');
check('fermé : la page défile de nouveau', await ev(`getComputedStyle(document.body).overflow !== 'hidden' && getComputedStyle(document.documentElement).overflow !== 'hidden'`), 'verrou resté');

/* ── 6. le bouton monte au-dessus de la barre de commande ────────────────── */
console.log('\n=== above the order bar ===');
if ((await ev(`document.querySelectorAll('.pick input').length`)) > 1) {
  await ev(`document.querySelectorAll('.pick input')[0].click()`);
  await ev(`window.scrollTo(0, document.querySelector('.bundle').offsetTop - 200)`);
  await sleep(700);
  check('le bouton flottant est au-dessus de .bundle', await ev(`(() => {
    const b = document.querySelector('.bundle').getBoundingClientRect();
    const d = document.querySelector('.tchat__dock').getBoundingClientRect();
    return b.top >= innerHeight || d.bottom <= b.top || getComputedStyle(document.querySelector('.tchat__dock')).visibility === 'hidden';
  })()`), 'recouvrement de .bundle');
} else {
  console.log('  (une seule pièce : pas de barre de commande)');
}

/* ── 7. Tyler en panne : le repli ────────────────────────────────────────── */
console.log('\n=== stub 500 shows fallback ===');
await stub('/__mode?fail=1');
await goto();
await click('.tchat__fab');
check('le message de repli', await waitFor(`!!document.querySelector('.tchat__msg--fail')`, 5000), 'pas de repli');
check('texte exact du repli', (await text('.tchat__msg--fail')) === "Can't reach Tyler right now, call us at 581-745-8680.", await text('.tchat__msg--fail'));
check('lien tel:', (await ev(`document.querySelector('.tchat__msg--fail a')?.getAttribute('href')`)) === 'tel:+15817458680', 'pas de tel:');
check('l\'indicateur ne reste pas', !(await exists('.tchat__typing')), 'typing reste');
check('en-tête « Offline » après le repli', (await text('.tchat__online')) === 'Offline', await text('.tchat__online'));
await shot('chat-fallback-390.png');
await stub('/__mode');
await type('.tchat__form input', 'hello again');
await click('.tchat__form button');
check('« Online » revient au prochain évènement réussi', await waitFor(`document.querySelector('.tchat__online')?.textContent === 'Online'`, 4000), await text('.tchat__online'));
await waitFor(`!document.querySelector('.tchat__typing')`, 4000);

/* ── 7b. le widget lui-même refuse un lien hors magasin ─────────────────────
   Le relais retire déjà ces propositions (tools/chatRelay.test.mjs) : pour tester le
   widget seul, la réponse de /api/chat/turn est fabriquée ici (Fetch.fulfillRequest). */
console.log('\n=== off-shop links are refused by the widget ===');
const fake = [
  { type: 'typing' },
  { type: 'message', text: 'Look: http://azmotorsport.ca/a and https://evil.example/b and https://www.azmotorsport.ca/ok. Clip: https://youtu.be/abc123, book: https://www.gorendezvous.com/azm and https://youtube.com.evil.example/x' },
  { type: 'proposal', url: 'https://evil.example/cart/1:1', items: [{ title: 'Evil part', option: 'X', priceCAD: 999 }], totalCAD: 999 },
  { type: 'proposal', url: 'http://azmotorsport.ca/cart/1:1', items: [{ title: 'Plain http part', option: 'X', priceCAD: 999 }], totalCAD: 999 },
  { type: 'done' }
].map((o) => `data: ${JSON.stringify(o)}\n\n`).join('');
const onPaused = async (m) => {
  if (m.method !== 'Fetch.requestPaused') return;
  await sleep(1500); // la réponse tarde : l'indicateur doit déjà être là (I4)
  await snd('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 200,
    responseHeaders: [{ name: 'Content-Type', value: 'text/event-stream' }], body: Buffer.from(fake).toString('base64') });
};
const prevOnMessage = ws.onmessage;
ws.onmessage = (e) => { prevOnMessage(e); try { onPaused(JSON.parse(e.data)); } catch { /* pas pour nous */ } };
await snd('Fetch.enable', { patterns: [{ urlPattern: '*/api/chat/turn*' }] });
const before = await ev(`document.querySelectorAll('.tchat__card').length`);
await type('.tchat__form input', 'show me');
await click('.tchat__form button');
check('« typing… » dès l\'envoi, avant toute réponse de Tyler', await waitFor(`!!document.querySelector('.tchat__typing')`, 400), 'pas d\'indicateur immédiat');
check('le message fabriqué arrive', await waitFor(`[...document.querySelectorAll('.tchat__msg')].some((m) => m.textContent.startsWith('Look:'))`, 5000), 'pas de message');
await sleep(300);
check('aucune carte pour une proposition hors magasin ou en http', (await ev(`document.querySelectorAll('.tchat__card').length`)) === before, 'carte affichée');
const textLinks = await ev(`[...[...document.querySelectorAll('.tchat__msg')].find((m) => m.textContent.startsWith('Look:')).querySelectorAll('a')].map((a) => a.getAttribute('href')).join()`);
check('liens de texte : magasin, vidéo, rendez-vous en https seulement (pas http, pas sosie)',
  textLinks === 'https://www.azmotorsport.ca/ok,https://youtu.be/abc123,https://www.gorendezvous.com/azm', textLinks);
await snd('Fetch.disable');
ws.onmessage = prevOnMessage;

/* ── 8. 25 s sans évènement : le repli ───────────────────────────────────── */
console.log('\n=== 25s of silence shows fallback ===');
await stub('/__mode?silent=1');
await goto();
await click('.tchat__fab');
check('« typing… » pendant le silence', await waitFor(`!!document.querySelector('.tchat__typing')`, 4000), 'pas d\'indicateur');
await sleep(20_000);
check('pas de repli avant 25 s', !(await exists('.tchat__msg--fail')), 'repli trop tôt');
check('le repli après 25 s de silence', await waitFor(`!!document.querySelector('.tchat__msg--fail')`, 8000), 'pas de repli');
await sleep(500);
check('le tour a été abandonné côté Tyler', (await stub('/__log'))[0]?.end !== null, JSON.stringify(await stub('/__log')));
check('console sans erreur', jsErrors.length === 0, jsErrors.join(' | '));

/* ── 9. un tour long mais vivant : le battement « : ping » tient le widget ── */
console.log('\n=== a long turn with heartbeats is not a failure ===');
await stub('/__mode?delay=28000&ping=1');
await goto();
await click('.tchat__fab');
check('« typing… » pendant le tour long', await waitFor(`!!document.querySelector('.tchat__typing')`, 4000), 'pas d\'indicateur');
await sleep(26_500);
check('pas de repli à 27 s (les « : ping » passent le relais)', !(await exists('.tchat__msg--fail')), 'repli malgré le battement');
check('le message arrive après 28 s', await waitFor(`[...document.querySelectorAll('.tchat__msg')].some((m) => m.textContent === "Quick check, it's a 2021 M3 you're working with?")`, 6000), 'pas de message');
check('toujours aucun repli', !(await exists('.tchat__msg--fail')), 'repli');

/* ── 10. Tommy a le fil : Tyler ne répond pas, le visiteur le sait ───────── */
console.log('\n=== blocked turn: Tommy will get back to you ===');
await stub('/__mode');
await goto();
await click('.tchat__fab');
await waitFor(`[...document.querySelectorAll('.tchat__msg')].some((m) => m.textContent.startsWith('Quick check'))`, 4000);
await stub('/__mode?blocked=handoff');
await type('.tchat__form input', 'Can I get it before Friday?');
await click('.tchat__form button');
check('la ligne « Tommy will get back to you »', await waitFor(`!!document.querySelector('.tchat__msg--note')`, 4000), 'pas de ligne');
check('texte exact', (await text('.tchat__msg--note')) === 'Tommy will get back to you shortly. You can also call 581-745-8680.', await text('.tchat__msg--note'));
check('lien tel:', (await ev(`document.querySelector('.tchat__msg--note a')?.getAttribute('href')`)) === 'tel:+15817458680', 'pas de tel:');
check('en-tête « Offline »', (await text('.tchat__online')) === 'Offline', await text('.tchat__online'));
check('aucun « typing… »', !(await exists('.tchat__typing')), 'typing affiché');
check('le message du visiteur reste affiché', await ev(`[...document.querySelectorAll('.tchat__msg--me')].some((m) => m.textContent === 'Can I get it before Friday?')`), 'message perdu');
await shot('chat-blocked-390.png');
await type('.tchat__form input', 'hello?');
await click('.tchat__form button');
await sleep(250);
check('pas de « typing… » sur un fil arrêté', !(await exists('.tchat__typing')), 'typing affiché');
await sleep(800);
check('la ligne Tommy n\'est pas répétée', (await ev(`document.querySelectorAll('.tchat__msg--note').length`)) === 1, 'répétée');
const tb = await stub('/__log');
check('les deux messages sont bien partis vers Tyler (gardés côté Tyler)', tb.map((x) => x.text).join('|') === 'Can I get it before Friday?|hello?', JSON.stringify(tb.map((x) => x.text)));
check('console sans erreur', jsErrors.length === 0, jsErrors.join(' | '));

/* ── 11. un long prénom ne fait pas déborder la bulle ────────────────────── */
console.log('\n=== long first name ===');
await stub('/__mode?name=' + encodeURIComponent('Maximilien-Alexandre Beauchemin-Tremblay'));
await ev('sessionStorage.clear()');
const t11 = Date.now();
await goto();
await sleep(Math.max(0, 16_000 - (Date.now() - t11)));
check('la bulle est là', await exists('.tchat__bubble'), 'pas de bulle');
const greet11 = (await text('.tchat__bubble p')).trim();
check('prénom : premier mot, 14 caractères, copie raccourcie pour tenir en deux lignes', greet11 === 'Hey Maximilien-Ale, need a hand with parts for your M3?', greet11);
const bh11 = await ev(`Math.round(document.querySelector('.tchat__bubble').getBoundingClientRect().height)`);
check('bulle ≤ 90 px de haut avec un long prénom', bh11 <= 90, `${bh11} px`);

await stub('/__mode');
ws.close(); proc.kill(); stubProc?.kill();
console.log(`\n=== BILAN ===\n  ${pass} passees, ${fails.length} echecs`);
process.exit(fails.length ? 1 : 0);
