/* Le relais vers Tyler, côté serveur seulement.
 *
 * Le navigateur parle à /api/chat/* (même origine) ; ce serveur vérifie le visiteur
 * (cookie azm_chat) puis relaie à Tyler avec le secret partagé. Le navigateur ne connaît
 * ni l'adresse de Tyler, ni le secret, ni l'id du contact.
 *
 * Variables : TYLER_URL, TYLER_WEBCHAT_SECRET (voir .env.example). TYLER_CHAT_FORCE=1
 * allume le chat sans toucher CONFIG.TYLER_CHAT — pour les essais ; en production
 * l'interrupteur, c'est CONFIG.TYLER_CHAT.
 */

import 'server-only';
import { CONFIG } from '@/lib/config';
import { CHAT_COOKIE, verifyChatToken } from '@/lib/chatToken';

const TIMEOUT_MS = 25_000;

export const chatEnabled = (): boolean => CONFIG.TYLER_CHAT || process.env.TYLER_CHAT_FORCE === '1';

export const tylerConfigured = (): boolean =>
  Boolean(process.env.TYLER_URL && process.env.TYLER_WEBCHAT_SECRET);

export function tylerFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const base = (process.env.TYLER_URL || '').replace(/\/+$/, '');
  const headers = new Headers(init.headers);
  headers.set('x-tyler-key', process.env.TYLER_WEBCHAT_SECRET || '');
  return fetch(base + path, { ...init, headers, cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) });
}

/* Le contact du visiteur, lu dans le cookie signé. null = pas de jeton valide. */
export function visitorContact(req: Request): string | null {
  const raw = req.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === CHAT_COOKIE) {
      return verifyChatToken(part.slice(i + 1).trim());
    }
  }
  return null;
}

/* Même choix d'en-têtes que /api/lead : celui que l'infrastructure garantit d'abord. */
export function clientIp(req: Request): string {
  return (
    (req.headers.get('x-vercel-forwarded-for') ||
      req.headers.get('x-real-ip') ||
      req.headers.get('x-forwarded-for') ||
      '')
      .split(',')[0]
      .trim() || 'unknown'
  );
}

/* Limite de débit au mieux, en mémoire (même approche que /api/lead : perdue au
   recyclage de l'instance, non partagée). 30 tours par IP et par 10 minutes. */
const WINDOW_MS = 10 * 60 * 1000;
export const MAX_TURNS = 30;
const hits = new Map<string, { start: number; n: number }>();

export function turnAllowed(ip: string): boolean {
  const now = Date.now();
  for (const [k, v] of hits) if (now - v.start > WINDOW_MS) hits.delete(k);
  let e = hits.get(ip);
  if (!e) {
    e = { start: now, n: 0 };
    hits.set(ip, e);
  }
  e.n += 1;
  return e.n <= MAX_TURNS;
}
