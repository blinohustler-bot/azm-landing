/* Banc d'essai de /api/lead — aucune requête ne sort de la machine.
 *
 *   node tools/lead.test.mjs        (ou : npm test)
 *
 * Le vrai GHL est remplacé par un faux fetch qui enregistre les requêtes émises :
 * on vérifie ce que la fonction envoie, pas la disponibilité du sous-compte.
 * Pour vérifier les vrais identifiants, c'est tools/ghl-check.mjs.
 */
process.env.GHL_API_KEY = 'pit-fake-token-0000';
process.env.GHL_LOCATION_ID = 'loc_TEST';
process.env.GHL_PIPELINE_NAME = 'Fitment';
process.env.GHL_STAGE_NAME = 'Nouveau lead';

const calls = [];
let existingOpp = null;

globalThis.fetch = async (url, init) => {
  const u = new URL(url);
  const body = init.body ? JSON.parse(init.body) : null;
  calls.push({ method: init.method, path: u.pathname, query: Object.fromEntries(u.searchParams), body });

  if (init.headers.Authorization !== 'Bearer pit-fake-token-0000') throw new Error('auth absente');
  if (!init.headers.Version) throw new Error('en-tête Version absent');

  const json = (o, status = 200) => ({ ok: status < 400, status, statusText: 'x', text: async () => JSON.stringify(o) });

  if (u.pathname === '/contacts/upsert') return json({ new: true, contact: { id: 'ct_1' } });
  if (u.pathname === '/opportunities/pipelines') {
    return json({ pipelines: [
      { id: 'pl_autre', name: 'Autre', stages: [{ id: 'sg_x', name: 'X', position: 0 }] },
      { id: 'pl_fit', name: 'Fitment', stages: [
        { id: 'sg_b', name: 'Contacté', position: 1 },
        { id: 'sg_a', name: 'Nouveau lead', position: 0 }
      ] }
    ] });
  }
  if (u.pathname === '/opportunities/search') return json({ opportunities: existingOpp ? [existingOpp] : [] });
  if (u.pathname === '/opportunities/') return json({ opportunity: { id: 'op_1' } });
  if (/^\/opportunities\/op_/.test(u.pathname)) return json({ opportunity: { id: 'op_1' } });
  if (/^\/contacts\/.+\/notes$/.test(u.pathname)) return json({ note: { id: 'nt_1' } });
  return json({ message: 'route inattendue ' + u.pathname }, 404);
};

const { default: handler } = await import('../api/lead.mjs');

function mkRes() {
  const r = { statusCode: 0, payload: null, headers: {} };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (o) => { r.payload = o; return r; };
  r.end = () => r;
  return r;
}
/* Chaque cas part d'une IP neuve : sinon c'est la limite de débit qu'on mesure,
   pas le cas. */
let ipSeq = 0;
const post = (body, headers = {}) =>
  ({ method: 'POST', headers: { 'x-forwarded-for': '10.0.0.' + (++ipSeq), ...headers }, body });

const GOOD = {
  source: 'fitment_lp', name: 'Alex Tremblay', email: 'ALEX@Email.com ', phone: '(514) 555-0134',
  make: 'BMW', model: 'M3', generation: '2015–2020 · F80', car: 'BMW M3 (2015–2020 · F80)',
  parts: [{ title: 'BMW F80 M3 Downpipes', price: 1899 }, { title: 'F8x Race Exhaust', price: 2450 }],
  page: 'https://azm.vercel.app/?utm_source=meta&utm_campaign=fitment_lp&fbclid=abc',
  elapsedMs: 9000, company: ''
};

let fails = 0;
const check = (label, cond, extra) => {
  console.log(`${cond ? '  ok  ' : '  ÉCHEC'} ${label}${cond ? '' : ' — ' + JSON.stringify(extra)}`);
  if (!cond) fails++;
};

/* 1 — chemin nominal */
let res = mkRes();
await handler(post(GOOD), res);
check('lead valide → 200', res.statusCode === 200, res.payload);

const upsert = calls.find((c) => c.path === '/contacts/upsert');
check('upsert appelé', !!upsert);
check('email minuscule + rogné', upsert.body.email === 'alex@email.com', upsert.body.email);
check('téléphone en E.164', upsert.body.phone === '+15145550134', upsert.body.phone);
check('prénom / nom séparés', upsert.body.firstName === 'Alex' && upsert.body.lastName === 'Tremblay', upsert.body);
check('locationId posé', upsert.body.locationId === 'loc_TEST');
check('source depuis l\'utm', upsert.body.source === 'meta — fitment LP', upsert.body.source);
check('tags posés', upsert.body.tags.includes('fitment-lp') && upsert.body.tags.includes('bmw'), upsert.body.tags);

const create = calls.find((c) => c.path === '/opportunities/' && c.method === 'POST');
check('opportunité créée', !!create);
check('pipeline résolu par nom', create.body.pipelineId === 'pl_fit', create.body.pipelineId);
check('étape choisie par nom', create.body.pipelineStageId === 'sg_a', create.body.pipelineStageId);
check('valeur = somme des prix plancher', create.body.monetaryValue === 4349, create.body.monetaryValue);
check('nom lisible', create.body.name === 'BMW M3 (2015–2020 · F80) — Alex Tremblay', create.body.name);
check('statut open', create.body.status === 'open');

const note = calls.find((c) => /notes$/.test(c.path));
check('note écrite', !!note);
check('note porte les pièces', note.body.body.includes('BMW F80 M3 Downpipes'), note.body.body);
check('note porte l\'utm', note.body.body.includes('utm_source = meta'));

/* 2 — le même contact revient : mise à jour, pas de doublon */
calls.length = 0;
existingOpp = { id: 'op_1', name: 'vieux nom' };
res = mkRes();
await handler(post({ ...GOOD, phone: '5145550134' }), res);
check('retour → 200', res.statusCode === 200, res.payload);
check('aucune création en double', !calls.some((c) => c.path === '/opportunities/' && c.method === 'POST'));
check('opportunité mise à jour', calls.some((c) => c.method === 'PUT' && c.path === '/opportunities/op_1'));
existingOpp = null;

/* 3 — le pipeline n'est plus redemandé (cache du lambda chaud) */
calls.length = 0;
res = mkRes();
await handler(post({ ...GOOD, email: 'b@x.co' }), res);
check('pipelines mis en cache', !calls.some((c) => c.path === '/opportunities/pipelines'));

/* 4 — refus */
const cases = [
  ['méthode GET', { ...post(GOOD), method: 'GET' }, 405],
  ['corps illisible', post('pas du json'), 400],
  ['courriel invalide', post({ ...GOOD, email: 'alex@' }), 400],
  ['téléphone trop court', post({ ...GOOD, phone: '514555' }), 400],
  ['nom vide', post({ ...GOOD, name: ' ' }), 400]
];
for (const [label, req, want] of cases) {
  const r = mkRes();
  await handler(req, r);
  check(`${label} → ${want}`, r.statusCode === want, r.statusCode);
}

/* 5 — pièges à robots : 200 muet, et rien n'atteint GHL */
for (const [label, patch] of [['champ piège rempli', { company: 'Acme' }], ['rempli en 300 ms', { elapsedMs: 300 }]]) {
  calls.length = 0;
  const r = mkRes();
  await handler(post({ ...patch, ...GOOD, ...patch }), r);
  check(`${label} → 200 muet`, r.statusCode === 200 && calls.length === 0, { code: r.statusCode, calls: calls.length });
}

/* 6 — origine */
process.env.ALLOWED_ORIGINS = 'https://azm.vercel.app';
let r = mkRes();
await handler(post(GOOD, { origin: 'https://evil.example' }), r);
check('origine étrangère → 403', r.statusCode === 403, r.statusCode);
r = mkRes();
await handler(post(GOOD, { origin: 'https://azm.vercel.app' }), r);
check('origine permise → 200', r.statusCode === 200, r.statusCode);
check('CORS renvoie l\'origine, pas *', r.headers['Access-Control-Allow-Origin'] === 'https://azm.vercel.app');
r = mkRes();
await handler(post(GOOD), r);
check('Origin absent → toléré', r.statusCode === 200, r.statusCode);
delete process.env.ALLOWED_ORIGINS;

/* 7 — les deux étages de la limite de débit */
const fixedIp = { 'x-forwarded-for': '203.0.113.7' };
let codes = [];
for (let i = 0; i < 8; i++) {
  const rr = mkRes();
  await handler({ method: 'POST', headers: fixedIp, body: { ...GOOD, email: 'u' + i + '@x.co' } }, rr);
  codes.push(rr.statusCode);
}
check('6 leads valides passent, le 7e est bloqué',
  codes.slice(0, 6).every((c) => c === 200) && codes.slice(6).every((c) => c === 429), codes);

/* Une IP qui se trompe de numéro dix fois ne doit PAS être bloquée ensuite. */
const clumsy = { 'x-forwarded-for': '203.0.113.8' };
for (let i = 0; i < 10; i++) {
  const rr = mkRes();
  await handler({ method: 'POST', headers: clumsy, body: { ...GOOD, phone: '514555' } }, rr);
}
const after = mkRes();
await handler({ method: 'POST', headers: clumsy, body: GOOD }, after);
check('10 saisies ratées puis une bonne → 200', after.statusCode === 200, after.statusCode);

/* Le plafond global, lui, finit par tomber. */
const flood = { 'x-forwarded-for': '203.0.113.9' };
let floodLast = 200;
for (let i = 0; i < 45; i++) {
  const rr = mkRes();
  await handler({ method: 'POST', headers: flood, body: { nope: true } }, rr);
  floodLast = rr.statusCode;
}
check('45 requêtes bidon → plafond global 429', floodLast === 429, floodLast);

/* 8 — une panne GHL ne fuit pas le détail vers le navigateur */
const saved = globalThis.fetch;
globalThis.fetch = async () => ({ ok: false, status: 401, statusText: 'x', text: async () => JSON.stringify({ message: 'jeton pit-fake-token-0000 invalide pour loc_TEST' }) });
r = mkRes();
await handler(post(GOOD, { 'x-forwarded-for': '9.9.9.9' }), r);
check('panne GHL → 502', r.statusCode === 502, r.statusCode);
check('réponse sans détail', JSON.stringify(r.payload) === '{"error":"upstream"}', r.payload);
globalThis.fetch = saved;

console.log(fails ? `\n  ${fails} échec(s)\n` : '\n  tout passe\n');
process.exit(fails ? 1 : 0);
