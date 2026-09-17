/* Banc d'essai de POST /api/lead — aucune requête ne sort de la machine.
 *
 *   node --conditions=react-server --import ./tools/alias-hook.mjs tools/lead.test.mjs
 *   (ou : npm test)
 *
 * Le vrai GHL est remplacé par un faux fetch qui enregistre les requêtes émises : on
 * vérifie ce que la route envoie, pas la disponibilité du sous-compte. La route testée
 * est le fichier de production lui-même — Node lit le TypeScript, et tools/alias-hook
 * lui apprend l'alias `@/`.
 *
 * Pour vérifier les vrais identifiants, c'est tools/ghl-check.mjs.
 */

process.env.GHL_API_KEY = 'pit-fake-token-0000';
process.env.GHL_LOCATION_ID = 'loc_TEST';
process.env.GHL_PIPELINE_NAME = 'Fitment';
process.env.GHL_STAGE_NAME = 'Nouveau lead';
delete process.env.ALLOWED_ORIGINS;
delete process.env.LEAD_DEBUG;

const calls = [];
let existingOpp = null;
let forceFailure = null;

const realFetch = globalThis.fetch;

globalThis.fetch = async (url, init) => {
  const u = new URL(url);
  const body = init.body ? JSON.parse(init.body) : null;
  calls.push({ method: init.method, path: u.pathname, query: Object.fromEntries(u.searchParams), body });

  if (init.headers.Authorization !== 'Bearer pit-fake-token-0000') throw new Error('auth absente');
  if (!init.headers.Version) throw new Error('en-tête Version absent');

  const json = (o, status = 200) => ({
    ok: status < 400, status, statusText: 'x', text: async () => JSON.stringify(o)
  });

  if (forceFailure) return json(forceFailure, 401);

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

const { POST, OPTIONS } = await import('@/app/api/lead/route.ts');
const { resetPipelineCache } = await import('@/lib/ghl.ts');

/* Chaque cas part d'une IP neuve : sinon c'est la limite de débit qu'on mesure,
   pas le cas. */
let ipSeq = 0;
function post(body, headers = {}) {
  const h = new Headers({ 'content-type': 'application/json', ...headers });
  if (!h.has('x-vercel-forwarded-for')) h.set('x-vercel-forwarded-for', '10.0.0.' + (++ipSeq));
  return new Request('https://azm.test/api/lead', {
    method: 'POST',
    headers: h,
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });
}

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
const bodyOf = async (res) => { try { return JSON.parse(await res.text()); } catch { return null; } };

/* 1 — chemin nominal */
let res = await POST(post(GOOD));
check('lead valide → 200', res.status === 200, await bodyOf(res));

const upsert = calls.find((c) => c.path === '/contacts/upsert');
check('upsert appelé', !!upsert);
check('email minuscule + rogné', upsert.body.email === 'alex@email.com', upsert.body.email);
check('téléphone en E.164', upsert.body.phone === '+15145550134', upsert.body.phone);
check('prénom / nom séparés', upsert.body.firstName === 'Alex' && upsert.body.lastName === 'Tremblay', upsert.body);
check('locationId posé', upsert.body.locationId === 'loc_TEST');
check("source depuis l'utm", upsert.body.source === 'meta — fitment LP', upsert.body.source);
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
check("note porte l'utm", note.body.body.includes('utm_source = meta'));

/* 2 — le même contact revient : mise à jour, pas de doublon */
calls.length = 0;
existingOpp = { id: 'op_1', name: 'vieux nom' };
res = await POST(post({ ...GOOD, phone: '5145550134' }));
check('retour → 200', res.status === 200, await bodyOf(res));
check('aucune création en double', !calls.some((c) => c.path === '/opportunities/' && c.method === 'POST'));
check('opportunité mise à jour', calls.some((c) => c.method === 'PUT' && c.path === '/opportunities/op_1'));
existingOpp = null;

/* 3 — le pipeline n'est plus redemandé (cache de l'instance chaude) */
calls.length = 0;
res = await POST(post({ ...GOOD, email: 'b@x.co' }));
check('pipelines mis en cache', !calls.some((c) => c.path === '/opportunities/pipelines'));

/* 4 — refus */
const cases = [
  ['corps illisible', post('pas du json'), 400],
  ['tableau au lieu d\'un objet', post('[1,2]'), 400],
  ['courriel invalide', post({ ...GOOD, email: 'alex@' }), 400],
  ['téléphone trop court', post({ ...GOOD, phone: '514555' }), 400],
  ['nom vide', post({ ...GOOD, name: ' ' }), 400],
  ['corps trop gros', post({ ...GOOD, name: 'x'.repeat(40 * 1024) }), 400]
];
for (const [label, req, want] of cases) {
  const r = await POST(req);
  check(`${label} → ${want}`, r.status === want, r.status);
}

/* 5 — pièges à robots : 200 muet, et rien n'atteint GHL */
for (const [label, patch] of [['champ piège rempli', { company: 'Acme' }], ['rempli en 300 ms', { elapsedMs: 300 }]]) {
  calls.length = 0;
  const r = await POST(post({ ...GOOD, ...patch }));
  check(`${label} → 200 muet`, r.status === 200 && calls.length === 0, { code: r.status, calls: calls.length });
}

/* 6 — origine */
process.env.ALLOWED_ORIGINS = 'https://azm.vercel.app';
let r = await POST(post(GOOD, { origin: 'https://evil.example' }));
check('origine étrangère → 403', r.status === 403, r.status);
r = await POST(post(GOOD, { origin: 'https://azm.vercel.app' }));
check('origine permise → 200', r.status === 200, r.status);
check("CORS renvoie l'origine, pas *", r.headers.get('access-control-allow-origin') === 'https://azm.vercel.app');
check('Vary: Origin posé', r.headers.get('vary') === 'Origin');
r = await POST(post(GOOD));
check('Origin absent → toléré', r.status === 200, r.status);
const pre = await OPTIONS(post(GOOD, { origin: 'https://azm.vercel.app' }));
check('préflight → 204', pre.status === 204, pre.status);
delete process.env.ALLOWED_ORIGINS;

/* 7 — les deux étages de la limite de débit */
const fixedIp = { 'x-vercel-forwarded-for': '203.0.113.7' };
const codes = [];
for (let i = 0; i < 8; i++) {
  const rr = await POST(post({ ...GOOD, email: `u${i}@x.co` }, fixedIp));
  codes.push(rr.status);
}
check('6 leads valides passent, le 7e est bloqué',
  codes.slice(0, 6).every((c) => c === 200) && codes.slice(6).every((c) => c === 429), codes);

/* Une IP qui se trompe de numéro dix fois ne doit PAS être bloquée ensuite. */
const clumsy = { 'x-vercel-forwarded-for': '203.0.113.8' };
for (let i = 0; i < 10; i++) await POST(post({ ...GOOD, phone: '514555' }, clumsy));
const after = await POST(post(GOOD, clumsy));
check('10 saisies ratées puis une bonne → 200', after.status === 200, after.status);

/* Le plafond global, lui, finit par tomber. */
const flood = { 'x-vercel-forwarded-for': '203.0.113.9' };
let floodLast = 200;
for (let i = 0; i < 45; i++) floodLast = (await POST(post({ nope: true }, flood))).status;
check('45 requêtes bidon → plafond global 429', floodLast === 429, floodLast);

/* 8 — une panne GHL ne fuit pas le détail vers le navigateur */
resetPipelineCache();
forceFailure = { message: 'jeton pit-fake-token-0000 invalide pour loc_TEST' };
r = await POST(post(GOOD, { 'x-vercel-forwarded-for': '9.9.9.9' }));
const failBody = await bodyOf(r);
check('panne GHL → 502', r.status === 502, r.status);
check('réponse sans détail', JSON.stringify(failBody) === '{"error":"upstream"}', failBody);
check('le jeton ne fuit pas', !JSON.stringify(failBody).includes('pit-fake'), failBody);
forceFailure = null;

globalThis.fetch = realFetch;
console.log(fails ? `\n  ${fails} échec(s)\n` : '\n  tout passe\n');
process.exit(fails ? 1 : 0);
