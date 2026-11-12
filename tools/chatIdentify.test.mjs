#!/usr/bin/env node
/* /api/chat/identify : retrouver le contact d'un visiteur qui revient, sans rien écrire.
 *   node --conditions=react-server --import ./tools/alias-hook.mjs tools/chatIdentify.test.mjs
 * Faux GHL : globalThis.fetch remplacé, aucune requête ne sort.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.CHAT_TOKEN_SECRET = 'secret-de-test-0000';
process.env.TYLER_CHAT_FORCE = '1';
process.env.GHL_API_KEY = 'pit-test';
process.env.GHL_LOCATION_ID = 'loc_test';

const { CHAT_COOKIE, verifyChatToken } = await import('@/lib/chatToken.ts');
const identify = await import('@/app/api/chat/identify/route.ts');

let calls = [];
/* Le sous-compte : un seul contact, ct_1, courriel a@b.co, téléphone +1 514 555 0101. */
const CONTACT = { id: 'ct_1', email: 'a@b.co', phone: '+15145550101' };
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(String(url));
  calls.push({ path: u.pathname, method: init.method || 'GET', q: Object.fromEntries(u.searchParams) });
  if (u.pathname === '/contacts/search/duplicate') {
    const byEmail = u.searchParams.get('email');
    const byNum = u.searchParams.get('number');
    const hit = (byEmail && byEmail.toLowerCase() === CONTACT.email) || (byNum && byNum.replace(/\D/g, '').endsWith('5145550101'));
    return Response.json({ contact: hit ? CONTACT : null });
  }
  return new Response('not stubbed', { status: 500 });
};

let ipN = 0;
const post = (body) => new Request('http://lp.test/api/chat/identify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-real-ip': `10.1.0.${++ipN}` },
  body: JSON.stringify(body)
});
const cookieOf = (r) => (r.headers.get('set-cookie') || '').match(new RegExp(`${CHAT_COOKIE}=([^;]+)`))?.[1];

test.beforeEach(() => { calls = []; });

test('email + phone of the same contact: cookie for THAT contact, nothing written', async () => {
  const r = await identify.POST(post({ email: 'A@B.co', phone: '(514) 555-0101' }));
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true });
  assert.equal(verifyChatToken(cookieOf(r)), 'ct_1');
  assert.ok(calls.every((c) => c.method === 'GET'), 'aucune écriture dans GHL');
});

test('right email, wrong phone: no cookie (an email alone never opens someone else\'s thread)', async () => {
  const r = await identify.POST(post({ email: 'a@b.co', phone: '514 555 9999' }));
  assert.deepEqual(await r.json(), { ok: false });
  assert.equal(cookieOf(r), undefined);
});

test('right phone, wrong email: no cookie', async () => {
  const r = await identify.POST(post({ email: 'x@y.co', phone: '514-555-0101' }));
  assert.deepEqual(await r.json(), { ok: false });
  assert.equal(cookieOf(r), undefined);
});

test('invalid input is 400, without any GHL call', async () => {
  assert.equal((await identify.POST(post({ email: 'nope', phone: '5145550101' }))).status, 400);
  assert.equal((await identify.POST(post({ email: 'a@b.co', phone: '123' }))).status, 400);
  assert.equal(calls.length, 0);
});

test('rate limit: the 11th lookup from one IP in 10 min is 429', async () => {
  const req = () => new Request('http://lp.test/api/chat/identify', {
    method: 'POST', headers: { 'x-real-ip': '10.9.9.9' }, body: JSON.stringify({ email: 'q@q.co', phone: '5145550000' })
  });
  for (let i = 0; i < 10; i++) assert.notEqual((await identify.POST(req())).status, 429);
  assert.equal((await identify.POST(req())).status, 429);
});
