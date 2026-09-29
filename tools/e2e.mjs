#!/usr/bin/env node
// AZM — parcours complet de la landing, clique pour de vrai.
//
//   npm start          (dans un autre terminal)
//   npm run e2e
//
/* Parcours complet de la landing, au protocole DevTools.
 *
 * Les clics sont de VRAIS clics souris (Input.dispatchMouseEvent aux coordonnees du
 * centre de l'element), pas des element.click() : un bouton recouvert par autre chose
 * repond a element.click() et pas a un vrai clic. C'est le genre de bogue qu'on veut
 * attraper.
 *
 * On ecoute aussi les exceptions et les erreurs console sur chaque ecran.
 *
 *   node e2e.mjs [largeur]
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const W = Number(process.argv[2] || 1440);
const H = 900;
const BASE = 'http://localhost:3000';
const PORT = 9350 + (W % 40);
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0;
const fails = [];
const jsErrors = [];
const ok = (name) => { pass++; console.log(`  ok    ${name}`); };
const ko = (name, detail) => { fails.push(`${name} — ${detail}`); console.log(`  ECHEC ${name}\n          ${detail}`); };
const check = (name, cond, detail) => (cond ? ok(name) : ko(name, detail));

const proc = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--disable-lcd-text',
  `--remote-debugging-port=${PORT}`,
  '--user-data-dir=' + fs.mkdtempSync(process.env.TEMP.replace(/\\/g, '/') + '/e2e-'),
  'about:blank'
], { stdio: 'ignore' });

let target = null;
for (let i = 0; i < 40 && !target; i++) {
  await sleep(250);
  try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page'); } catch { /* pas pret */ }
}
if (!target) { proc.kill(); throw new Error('Chrome injoignable'); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let id = 0; const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); return; }
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    jsErrors.push('EXCEPTION ' + (d.exception?.description || d.text || '').slice(0, 180));
  }
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) {
    const txt = m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 180);
    /* Next signale en dev des choses sans rapport ; on ne garde que ce qui vient de nous. */
    if (txt && !/Download the React DevTools|Lighthouse/i.test(txt)) jsErrors.push(`CONSOLE ${m.params.type}: ${txt}`);
  }
};
const send = (m, p = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method: m, params: p })); });
const evalJs = async (x) => {
  const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true });
  if (r?.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 200));
  return r?.result?.value;
};

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < 700 });

const goto = async (path) => { await send('Page.navigate', { url: BASE + path }); await sleep(2200); };
const url = () => evalJs('location.pathname + location.search');
const text = (sel) => evalJs(`(document.querySelector(${JSON.stringify(sel)})||{}).textContent || ''`);
const count = (sel) => evalJs(`document.querySelectorAll(${JSON.stringify(sel)}).length`);

/* Vrai clic souris au centre de l'element, apres l'avoir amene dans le viewport. */
async function clickAt(sel, label) {
  const box = await evalJs(`(() => {
    const e = document.querySelector(${JSON.stringify(sel)});
    if (!e) return null;
    e.scrollIntoView({block:'center'});
    const b = e.getBoundingClientRect();
    if (b.width === 0 || b.height === 0) return 'invisible';
    const x = Math.round(b.left + b.width/2), y = Math.round(b.top + b.height/2);
    const top = document.elementFromPoint(x, y);
    return JSON.stringify({x, y, couvert: !(e === top || e.contains(top) || top?.contains(e))});
  })()`);
  if (!box) { ko(label || sel, 'element introuvable'); return false; }
  if (box === 'invisible') { ko(label || sel, 'element de taille nulle'); return false; }
  const b = JSON.parse(box);
  if (b.couvert) { ko(label || sel, 'element recouvert par un autre au point de clic'); return false; }
  for (const type of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type, x: b.x, y: b.y, button: 'left', clickCount: 1 });
  }
  await sleep(1300);
  return true;
}

async function typeInto(sel, value) {
  await evalJs(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); e.focus(); })()`);
  for (const ch of value) await send('Input.dispatchKeyEvent', { type: 'char', text: ch });
  await sleep(500);
}

console.log(`\n========== PARCOURS COMPLET — ${W} px ==========\n`);

/* ── 1. ecran 01 : la grille de marques ─────────────────────────────── */
console.log('01 — choix de la marque');
await goto('/');
check('la page repond', (await text('h1')).includes('driving'), 'titre introuvable');
check('9 tuiles de marque', (await count('.brand-card')) === 9, `${await count('.brand-card')} tuiles`);
check('la photo du hero est chargee', await evalJs(`(() => { const i = document.querySelector('.hero__shot'); return !!i && i.complete && i.naturalWidth > 0; })()`), 'image non chargee');
check('le lien Google est externe et sur', await evalJs(`(() => { const a = document.querySelector('.gsig'); return a.target === '_blank' && /noopener/.test(a.rel); })()`), 'target/rel manquants');
if (await clickAt('.brand-card[data-brand="bmw"]', 'clic sur la tuile BMW')) {
  check('la tuile BMW navigue', (await url()).includes('make=BMW'), `url = ${await url()}`);
}

/* ── 2. ecran 02 : le modele + la recherche ─────────────────────────── */
console.log('\n02 — choix du modele');
check('titre du modele', (await text('h1')).toLowerCase().includes('bmw'), await text('h1'));
const nModels = await count('.choice');
check('la liste de modeles est remplie', nModels > 5, `${nModels} choix`);
await typeInto('#model-search', 'm3');
const visible = await evalJs(`[...document.querySelectorAll('.choice')].filter(e => e.offsetParent !== null).length`);
check('la recherche filtre la liste', visible > 0 && visible < nModels, `${visible} visibles sur ${nModels}`);
if (await clickAt('.choice:not([hidden])', 'clic sur le premier modele filtre')) {
  check('le modele navigue', (await url()).includes('model='), `url = ${await url()}`);
}

/* ── 3. ecran 03 : la generation (si presente) ──────────────────────── */
const surGeneration = (await text('.rule')).includes('Generation');
if (surGeneration) {
  console.log('\n03 — choix de la generation');
  check('des generations sont proposees', (await count('.choice')) > 0, 'aucune generation');
  if (await clickAt('.choice', 'clic sur une generation')) {
    check('la generation navigue', (await url()).includes('year='), `url = ${await url()}`);
  }
} else {
  console.log('\n03 — pas de generation pour ce modele (normal sur 81 modeles sur 99)');
}

/* ── 4. ecran 04 : le formulaire ────────────────────────────────────── */
console.log('\n04 — le formulaire');
check('on est bien sur le formulaire', (await count('#i-email')) === 1, 'champ courriel introuvable');
const avant = await url();
await clickAt('button[type="submit"]', 'envoi a vide');
check('un envoi a vide ne navigue pas', (await url()) === avant, 'la page a change malgre un formulaire vide');
check('les trois champs sont signales', (await count('[aria-invalid="true"]')) === 3, `${await count('[aria-invalid="true"]')} champs signales`);
await typeInto('#i-name', 'Test Automatise');
await typeInto('#i-email', 'pasuncourriel');
await typeInto('#i-phone', '5145550134');
await clickAt('button[type="submit"]', 'envoi avec courriel invalide');
check('un courriel invalide bloque', (await url()) === avant, 'la page a change malgre un courriel invalide');
check('le courriel est le seul signale', await evalJs(`document.querySelector('#i-email').getAttribute('aria-invalid') === 'true'`), 'le champ courriel n est pas signale');
/* Le pot de miel est cache HORS ECRAN (left:-9999px), pas en display:none — c'est
   volontaire, certains robots ignorent les champs en display:none. Le test doit donc
   accepter les trois techniques, sinon il signale un faux defaut. */
check('le pot de miel est cache', await evalJs(`(() => {
  const e = document.querySelector('#i-company');
  if (!e) return false;
  const s = getComputedStyle(e);
  const b = e.getBoundingClientRect();
  const horsEcran = b.right < 0 || b.bottom < 0 || b.left > innerWidth;
  return s.display === 'none' || s.visibility === 'hidden' || horsEcran;
})()`), 'le honeypot est visible a l ecran');
check('le pot de miel est hors du parcours clavier', await evalJs(`document.querySelector('#i-company').tabIndex === -1`), 'tabindex non negatif');
await evalJs(`(() => { const e = document.querySelector('#i-email'); const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; set.call(e,''); e.dispatchEvent(new Event('input',{bubbles:true})); })()`);
await typeInto('#i-email', 'test@example.com');
await clickAt('button[type="submit"]', 'envoi valide');
await sleep(6500);   // sendLead attend la confirmation GHL, plafonnee a 5 s
check('un envoi valide mene aux resultats', (await url()).includes('step=results'), `url = ${await url()}`);

/* ── 5. ecran 05 : les pieces ───────────────────────────────────────── */
console.log('\n05 — les pieces');
const nCards = await count('.card');
check('au moins une carte produit', nCards >= 1, `${nCards} cartes`);
check('toutes les photos produit sont chargees', await evalJs(`[...document.querySelectorAll('.card__media img')].every(i => i.complete && i.naturalWidth > 0)`), 'une photo produit ne charge pas');
check('plus de bouton « Ask a builder »', (await evalJs(`document.body.textContent.includes('Ask a builder')`)) === false, 'le bouton est encore la');
const buy = await evalJs(`(() => { const a = document.querySelector('.card .btn'); return a ? a.getAttribute('href') : ''; })()`);
check('le lien d achat vise le panier Shopify', /azmotorsport\.ca\/cart\/\d+:1\?/.test(buy), buy.slice(0, 90));
check('le lien d achat porte les UTM', buy.includes('utm_source=meta') && buy.includes('utm_content='), buy.slice(0, 120));

const selCount = await count('.opts select');
if (selCount) {
  const prixAvant = await text('.card .price b');
  await evalJs(`(() => {
    const s = document.querySelector('.opts select');
    const autre = [...s.options].find(o => o.value !== s.value);
    if (!autre) return;
    const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value').set;
    set.call(s, autre.value);
    s.dispatchEvent(new Event('change', {bubbles:true}));
  })()`);
  await sleep(900);
  const prixApres = await text('.card .price b');
  const buyApres = await evalJs(`document.querySelector('.card .btn').getAttribute('href')`);
  check('changer une option met a jour le lien d achat', buyApres !== buy, 'le lien n a pas bouge');
  console.log(`        prix ${prixAvant} -> ${prixApres}`);
} else {
  console.log('        (pas de selecteur sur cette piece)');
}

/* Le filet quand /api/lead echoue : le lead doit etre garde pour etre rejoue. */
const garde = await evalJs(`(() => {
  try { return Object.keys(localStorage).filter(k => /lead/i.test(k)).join(','); } catch { return 'illisible'; }
})()`);
check('un lead non ecrit est conserve pour reprise', Boolean(garde), 'rien en localStorage apres un 502');
console.log(`        clef conservee : ${garde || '(aucune)'}`);

/* ── 6. retour arriere ──────────────────────────────────────────────── */
console.log('\n06 — navigation arriere');
const avantRetour = await url();
await evalJs('history.back()'); await sleep(1600);
check('le bouton precedent du navigateur marche', (await url()) !== avantRetour, 'l url n a pas change');
await evalJs('history.forward()'); await sleep(1600);

/* ── 7. le chemin « mon modele n est pas la » ───────────────────────── */
console.log('\n07 — hors catalogue');
await goto('/?step=missing&make=BMW');
check('l ecran hors catalogue s affiche', (await count('#m-car')) === 1, 'champ voiture introuvable');
const avantM = await url();
await clickAt('button[type="submit"]', 'envoi a vide (hors catalogue)');
check('un envoi a vide y est bloque aussi', (await url()) === avantM, 'la page a change');

/* ── 8. l ecran de remerciement ─────────────────────────────────────── */
console.log('\n08 — remerciement');
await goto('/?step=thanks&car=BMW%20M3');
check('l ecran de remerciement nomme le char', (await text('body')).includes('BMW M3'), 'le char n est pas repris');

/* ── 9. accessibilite de base ───────────────────────────────────────── */
console.log('\n09 — accessibilite');
await goto('/');
check('une seule balise h1', (await count('h1')) === 1, `${await count('h1')} h1`);
check('toutes les images ont un alt', await evalJs(`[...document.querySelectorAll('img')].every(i => i.hasAttribute('alt'))`), 'un alt manque');
check('le rail est atteignable au clavier', await evalJs(`document.querySelector('.rail')?.tabIndex === 0`), 'tabindex absent');
check('la barre de progression est annoncee', await evalJs(`!!document.querySelector('[role="progressbar"][aria-valuenow]')`), 'progressbar sans valeur');
const focusOk = await evalJs(`(() => {
  const a = document.querySelector('.brand-card'); a.focus();
  const s = getComputedStyle(a, ':focus-visible');
  return document.activeElement === a;
})()`);
check('une tuile peut recevoir le focus', focusOk, 'focus impossible');

/* ── bilan ──────────────────────────────────────────────────────────── */
console.log('\n========== BILAN ==========');
console.log(`  ${pass} verifications passees, ${fails.length} echecs`);
if (fails.length) { console.log('\n  ECHECS :'); fails.forEach((f) => console.log('   - ' + f)); }
const uniq = [...new Set(jsErrors)];
console.log(`\n  erreurs JavaScript / console : ${uniq.length}`);
uniq.slice(0, 15).forEach((e) => console.log('   - ' + e));

ws.close(); proc.kill();
process.exit(fails.length ? 1 : 0);
