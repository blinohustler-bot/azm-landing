/* Jeton de contact du chat — dit à Tyler QUEL contact GHL écrit, sans jamais exposer son id.
 *
 * /api/lead pose ce jeton en cookie httpOnly après l'upsert ; les routes du chat le
 * vérifient côté serveur. Format : base64url(contactId).expirationEnSecondes.base64url(hmac),
 * la signature couvrant les deux premiers segments (l'expiration ne peut pas être
 * rallongée). Valide 30 jours. Sans CHAT_TOKEN_SECRET : on ne signe pas (throw) et rien
 * ne se vérifie (null).
 */

import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

export const CHAT_COOKIE = 'azm_chat';
export const CHAT_TOKEN_TTL_S = 30 * 24 * 3600;

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64url');

function mac(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function signChatToken(contactId: string, now: number = Date.now()): string {
  const secret = process.env.CHAT_TOKEN_SECRET;
  if (!secret) throw new Error('CHAT_TOKEN_SECRET manquant');
  const payload = `${b64(contactId)}.${Math.floor(now / 1000) + CHAT_TOKEN_TTL_S}`;
  return `${payload}.${mac(payload, secret)}`;
}

export function verifyChatToken(token: string | undefined, now: number = Date.now()): string | null {
  const secret = process.env.CHAT_TOKEN_SECRET;
  if (!secret || !token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [id, exp, sig] = parts;
  if (!/^\d+$/.test(exp) || Number(exp) * 1000 <= now) return null;
  const expected = Buffer.from(mac(`${id}.${exp}`, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const contactId = Buffer.from(id, 'base64url').toString('utf8');
  return contactId || null;
}
