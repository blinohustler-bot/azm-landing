/* Banc d'essai du jeton de contact du chat (lib/chatToken.ts).
 *
 *   node --conditions=react-server --import ./tools/alias-hook.mjs tools/chat.test.mjs
 *   (ou : npm test)
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { signChatToken, verifyChatToken, CHAT_COOKIE } = await import('@/lib/chatToken.ts');

const DAY = 24 * 3600 * 1000;

test.beforeEach(() => { process.env.CHAT_TOKEN_SECRET = 'secret-de-test-0000'; });

test('cookie name is azm_chat', () => {
  assert.equal(CHAT_COOKIE, 'azm_chat');
});

test('round trip returns the contact id', () => {
  const t = signChatToken('ct_abc123');
  assert.equal(verifyChatToken(t), 'ct_abc123');
});

test('tampered token is rejected', () => {
  const t = signChatToken('ct_abc123');
  const i = t.length - 3;
  const tampered = t.slice(0, i) + (t[i] === 'A' ? 'B' : 'A') + t.slice(i + 1);
  assert.equal(verifyChatToken(tampered), null);
  /* changer le contact ou l'expiration invalide aussi la signature */
  const [id, exp, sig] = t.split('.');
  assert.equal(verifyChatToken([Buffer.from('ct_autre').toString('base64url'), exp, sig].join('.')), null);
  assert.equal(verifyChatToken([id, String(Number(exp) + 999999), sig].join('.')), null);
});

test('expired token is rejected', () => {
  const t = signChatToken('ct_abc123');
  assert.equal(verifyChatToken(t, Date.now() + 31 * DAY), null);
  assert.equal(verifyChatToken(t, Date.now() + 29 * DAY), 'ct_abc123');
});

test('garbage and missing tokens are rejected', () => {
  assert.equal(verifyChatToken(undefined), null);
  assert.equal(verifyChatToken(''), null);
  assert.equal(verifyChatToken('a.b'), null);
  assert.equal(verifyChatToken('a.b.c.d'), null);
});

test('missing secret never verifies', () => {
  const t = signChatToken('ct_abc123');
  process.env.CHAT_TOKEN_SECRET = '';
  assert.throws(() => signChatToken('ct_abc123'));
  assert.equal(verifyChatToken(t), null);
});
