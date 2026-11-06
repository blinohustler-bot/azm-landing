/* Banc d'essai du relais /api/chat/* — aucune requête ne sort de la machine.
 *
 *   node --conditions=react-server --import ./tools/alias-hook.mjs tools/chatRelay.test.mjs
 *   (ou : npm test)
 *
 * Tyler est remplacé par un faux fetch qui enregistre ce que le relais envoie. Le
 * jeton de contact est signé avec le vrai lib/chatToken.ts. Le chat est allumé par
 * TYLER_CHAT_FORCE=1 (CONFIG.TYLER_CHAT vaut false par défaut).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.CHAT_TOKEN_SECRET = 'secret-de-test-0000';
process.env.TYLER_URL = 'http://tyler.test';
process.env.TYLER_WEBCHAT_SECRET = 'tyler-secret-0000';
process.env.TYLER_CHAT_FORCE = '1';

const { signChatToken, CHAT_COOKIE } = await import('@/lib/chatToken.ts');
const { TIMEOUTS } = await import('@/lib/tyler.ts');
const { screenFor } = await import('@/lib/chatScreen.ts');
const catalog = (await import('@/lib/catalog.ts')).default;
const status = await import('@/app/api/chat/status/route.ts');
const presence = await import('@/app/api/chat/presence/route.ts');
const turn = await import('@/app/api/chat/turn/route.ts');

/* Une voiture réelle du catalogue, prise sur la première marque qui a des pièces. */
const make = catalog.makes[0];
const model = make.models.find((m) => m.generations.length && m.products.length) || make.models[0];
const gen = model.generations[0];
const CAR = { make: make.make, model: model.key, year: String(gen.from) };

let calls = [];
let upstream = () => new Response('data: {"type":"done"}\n\n', { status: 200 });
globalThis.fetch = async (url, init = {}) => {
  calls.push({ url: String(url), method: init.method || 'GET', headers: new Headers(init.headers), body: init.body ? JSON.parse(init.body) : null });
  return upstream(url, init);
};

const cookie = () => `${CHAT_COOKIE}=${signChatToken('ct_abc123')}`;
let ipN = 0;
const freshIp = () => `10.0.0.${++ipN}`;

const get = (path, headers = {}) => new Request('http://lp.test' + path, { headers });
const post = (path, body, headers = {}) =>
  new Request('http://lp.test' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-real-ip': freshIp(), ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });

test.beforeEach(() => {
  calls = [];
  upstream = () => new Response('data: {"type":"done"}\n\n', { status: 200 });
  process.env.TYLER_URL = 'http://tyler.test';
  process.env.TYLER_WEBCHAT_SECRET = 'tyler-secret-0000';
  process.env.TYLER_CHAT_FORCE = '1';
});

test('screenFor rebuilds the screen from the catalog', () => {
  const s = screenFor(CAR.make, CAR.model, CAR.year);
  assert.ok(s && s.car.includes(make.make));
  assert.ok(s.parts.length > 0 && s.parts.length <= 8);
  const p = s.parts[0];
  const real = catalog.products[String(p.productId)];
  assert.equal(p.title, real.title);
  assert.deepEqual(p.variants[0], { id: real.variants[0].id, title: real.variants[0].title, priceCAD: real.variants[0].price });
  assert.equal(screenFor('nope', 'nope'), null);
  assert.equal(screenFor(CAR.make, 'nope'), null);
});

test('status without cookie is 401', async () => {
  const r = await status.GET(get('/api/chat/status'));
  assert.equal(r.status, 401);
  assert.equal(calls.length, 0);
});

test('status with a valid cookie relays enabled + firstName', async () => {
  upstream = () => Response.json({ enabled: true, firstName: 'Alex', reason: 'secret' });
  const r = await status.GET(get('/api/chat/status', { cookie: cookie() }));
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { enabled: true, firstName: 'Alex' });
  assert.equal(calls[0].url, 'http://tyler.test/api/webchat/status?contactId=ct_abc123');
  assert.equal(calls[0].headers.get('x-tyler-key'), 'tyler-secret-0000');
});

test('status is disabled when the gate is off or Tyler is not configured', async () => {
  delete process.env.TYLER_CHAT_FORCE;
  assert.deepEqual(await (await status.GET(get('/api/chat/status', { cookie: cookie() }))).json(), { enabled: false });
  process.env.TYLER_CHAT_FORCE = '1';
  delete process.env.TYLER_URL;
  assert.deepEqual(await (await status.GET(get('/api/chat/status', { cookie: cookie() }))).json(), { enabled: false });
  assert.equal(calls.length, 0);
});

test('status is disabled when Tyler fails', async () => {
  upstream = () => new Response('boom', { status: 500 });
  assert.deepEqual(await (await status.GET(get('/api/chat/status', { cookie: cookie() }))).json(), { enabled: false });
});

test('presence relays and answers 204; 401 without cookie; 503 unconfigured', async () => {
  assert.equal((await presence.POST(post('/api/chat/presence', {}))).status, 401);
  const r = await presence.POST(post('/api/chat/presence', {}, { cookie: cookie() }));
  assert.equal(r.status, 204);
  assert.deepEqual(calls[0].body, { contactId: 'ct_abc123' });
  delete process.env.TYLER_WEBCHAT_SECRET;
  assert.equal((await presence.POST(post('/api/chat/presence', {}, { cookie: cookie() }))).status, 503);
});

test('turn with a bad body is 400', async () => {
  const h = { cookie: cookie() };
  for (const body of ['not json', {}, { text: 5, ...CAR }, { text: 'hi', make: 3, model: 'x' }, { text: 'hi', make: 'nope', model: 'nope' },
    { text: 'x'.repeat(1001), ...CAR }]) {
    const r = await turn.POST(post('/api/chat/turn', body, h));
    assert.equal(r.status, 400, JSON.stringify(body).slice(0, 60));
  }
  assert.equal(calls.length, 0);
});

test('turn without cookie is 401, unconfigured is 503', async () => {
  assert.equal((await turn.POST(post('/api/chat/turn', { text: null, ...CAR }))).status, 401);
  delete process.env.TYLER_URL;
  assert.equal((await turn.POST(post('/api/chat/turn', { text: null, ...CAR }, { cookie: cookie() }))).status, 503);
});

test('turn rebuilds the screen server-side and ignores the browser screen', async () => {
  upstream = () => new Response('data: {"type":"typing"}\n\ndata: {"type":"done"}\n\n', { status: 200 });
  const forged = { car: 'Forgery', parts: [{ productId: 1, title: 'Free', variants: [{ id: 1, title: 'x', priceCAD: 1 }] }] };
  const r = await turn.POST(post('/api/chat/turn', { text: 'hello', ...CAR, screen: forged }, { cookie: cookie() }));
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /text\/event-stream/);
  assert.equal(await r.text(), 'data: {"type":"typing"}\n\ndata: {"type":"done"}\n\n');
  const sent = calls[0];
  assert.equal(sent.url, 'http://tyler.test/api/webchat/turn');
  assert.equal(sent.body.contactId, 'ct_abc123');
  assert.equal(sent.body.text, 'hello');
  assert.deepEqual(sent.body.screen, screenFor(CAR.make, CAR.model, CAR.year));
  assert.notEqual(sent.body.screen.car, 'Forgery');
  assert.equal(sent.headers.get('x-tyler-key'), 'tyler-secret-0000');
});

test('turn accepts text null (opening turn) and no year', async () => {
  const r = await turn.POST(post('/api/chat/turn', { text: null, make: CAR.make, model: CAR.model }, { cookie: cookie() }));
  assert.equal(r.status, 200);
  assert.equal(calls[0].body.text, null);
});

test('upstream 500 and network errors become an SSE error + done', async () => {
  const expected = 'data: {"type":"error","message":"unreachable"}\n\ndata: {"type":"done"}\n\n';
  upstream = () => new Response('boom', { status: 500 });
  let r = await turn.POST(post('/api/chat/turn', { text: 'hi', ...CAR }, { cookie: cookie() }));
  assert.equal(r.status, 200);
  assert.equal(await r.text(), expected);
  upstream = () => { throw new Error('ECONNREFUSED'); };
  r = await turn.POST(post('/api/chat/turn', { text: 'hi', ...CAR }, { cookie: cookie() }));
  assert.equal(r.status, 200);
  assert.equal(await r.text(), expected);
});

test('upstream error events are replaced by the generic error; others pass through', async () => {
  upstream = () => new Response(
    'data: {"type":"typing"}\n\ndata: {"type":"error","message":"Draft order failed: secret detail"}\n\ndata: {"type":"done"}\n\n',
    { status: 200 });
  const r = await turn.POST(post('/api/chat/turn', { text: 'hi', ...CAR }, { cookie: cookie() }));
  const out = await r.text();
  assert.equal(out, 'data: {"type":"typing"}\n\ndata: {"type":"error","message":"unreachable"}\n\ndata: {"type":"done"}\n\n');
  assert.ok(!out.includes('secret detail'));
});

test('proposals whose url is not the shop host are dropped; shop proposals pass', async () => {
  const prop = (url) => `data: ${JSON.stringify({ type: 'proposal', url, items: [{ title: 'X', option: 'Y', priceCAD: 1 }], totalCAD: 1 })}\n\n`;
  const bad = ['https://evil.example/cart/1:1', 'http://azmotorsport.ca/cart/1:1', 'https://azmotorsport.ca.evil.example/cart/1:1',
    'javascript:alert(1)', 'https://user@azmotorsport.ca/cart/1:1'];
  upstream = () => new Response(bad.map(prop).join('') + prop('https://www.azmotorsport.ca/cart/2:1') + prop('https://azmotorsport.ca/cart/3:1') +
    'data: {"type":"done"}\n\n', { status: 200 });
  const r = await turn.POST(post('/api/chat/turn', { text: 'hi', ...CAR }, { cookie: cookie() }));
  const out = await r.text();
  for (const u of bad) assert.ok(!out.includes(JSON.stringify(u)), `kept ${u}`);
  assert.ok(out.includes('https://www.azmotorsport.ca/cart/2:1'));
  assert.ok(out.includes('https://azmotorsport.ca/cart/3:1'));
  assert.ok(out.includes('"type":"done"'));
});

/* Un flux amont qui émet les morceaux donnés à intervalles réguliers, et qui meurt
   (erreur de lecture) quand le signal du relais s'abrège. */
const slowStream = (chunks, gapMs, init, { end = true } = {}) =>
  new Response(new ReadableStream({
    start(ctl) {
      let i = 0;
      const t = setInterval(() => {
        if (i < chunks.length) ctl.enqueue(new TextEncoder().encode(chunks[i++]));
        else { clearInterval(t); if (end) ctl.close(); }
      }, gapMs);
      init?.signal?.addEventListener('abort', () => { clearInterval(t); ctl.error(new Error('aborted')); });
    }
  }), { status: 200 });

test('a stream longer than the headers timeout is relayed completely', async () => {
  const saved = { ...TIMEOUTS };
  Object.assign(TIMEOUTS, { headers: 50, total: 2000 }); // ancien plafond 25 s simulé par 50 ms
  try {
    upstream = (u, init) => slowStream(['data: {"type":"message","text":"a"}\n\n', 'data: {"type":"message","text":"b"}\n\n',
      'data: {"type":"done"}\n\n'], 60, init);
    const r = await turn.POST(post('/api/chat/turn', { text: 'hi', ...CAR }, { cookie: cookie() }));
    assert.equal(await r.text(),
      'data: {"type":"message","text":"a"}\n\ndata: {"type":"message","text":"b"}\n\ndata: {"type":"done"}\n\n');
  } finally { Object.assign(TIMEOUTS, saved); }
});

test('a stream exceeding the overall cap ends with generic error + done', async () => {
  const saved = { ...TIMEOUTS };
  Object.assign(TIMEOUTS, { headers: 50, total: 150 });
  try {
    upstream = (u, init) => slowStream(['data: {"type":"message","text":"a"}\n\n'], 40, init, { end: false });
    const r = await turn.POST(post('/api/chat/turn', { text: 'hi', ...CAR }, { cookie: cookie() }));
    assert.equal(await r.text(),
      'data: {"type":"message","text":"a"}\n\ndata: {"type":"error","message":"unreachable"}\n\ndata: {"type":"done"}\n\n');
  } finally { Object.assign(TIMEOUTS, saved); }
});

test('a stream that ends without done gets error + done appended', async () => {
  upstream = () => new Response('data: {"type":"message","text":"a"}\n\n', { status: 200 });
  const r = await turn.POST(post('/api/chat/turn', { text: 'hi', ...CAR }, { cookie: cookie() }));
  assert.equal(await r.text(),
    'data: {"type":"message","text":"a"}\n\ndata: {"type":"error","message":"unreachable"}\n\ndata: {"type":"done"}\n\n');
});

test('rate limit: 30 turns per IP, the 31st is 429', async () => {
  const ip = { 'x-real-ip': '203.0.113.9', cookie: cookie() };
  for (let i = 0; i < 30; i++) {
    const r = await turn.POST(post('/api/chat/turn', { text: 'hi', ...CAR }, ip));
    assert.equal(r.status, 200, `turn ${i + 1}`);
  }
  assert.equal((await turn.POST(post('/api/chat/turn', { text: 'hi', ...CAR }, ip))).status, 429);
  /* une autre IP n'est pas touchée */
  assert.equal((await turn.POST(post('/api/chat/turn', { text: 'hi', ...CAR }, { cookie: cookie() }))).status, 200);
});
