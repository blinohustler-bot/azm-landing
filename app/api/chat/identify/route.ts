/* POST /api/chat/identify — { email, phone } → pose le cookie azm_chat du contact GHL
 * EXISTANT qui porte ce courriel ET ce téléphone. Rien n'est écrit dans GHL.
 *
 * Pour qui : le visiteur qui revient (lead d'avant le chat, ou cookie expiré). Le widget
 * lui relit ses coordonnées gardées par sendLead (localStorage azm_lead) et appelle cette
 * route en silence : le chat s'ouvre sur SON fil, et Tyler voit tout l'historique.
 * { ok: false } = aucun contact sûr : le widget demande les coordonnées et passe par
 * /api/lead (qui, lui, retrouve ou crée le contact et met l'opportunité à jour).
 */

import { chatEnabled, clientIp } from '@/lib/tyler';
import { findContactByEmailAndPhone } from '@/lib/ghl';
import { normalizePhone } from '@/lib/leadPayload';
import { CHAT_COOKIE, CHAT_TOKEN_TTL_S, signChatToken } from '@/lib/chatToken';

export const dynamic = 'force-dynamic';

const json = (body: unknown, status = 200, extra?: Headers) => {
  const h = extra ?? new Headers();
  h.set('Content-Type', 'application/json');
  h.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(body), { status, headers: h });
};

/* Au mieux, en mémoire (comme /api/lead) : 10 recherches par IP et par 10 minutes. Un
   script qui essaie des couples courriel + téléphone est arrêté net. */
const WINDOW_MS = 10 * 60 * 1000;
export const MAX_IDENTIFY = 10;
const hits = new Map<string, { start: number; n: number }>();
function allowed(ip: string): boolean {
  const now = Date.now();
  for (const [k, v] of hits) if (now - v.start > WINDOW_MS) hits.delete(k);
  let e = hits.get(ip);
  if (!e) hits.set(ip, (e = { start: now, n: 0 }));
  e.n += 1;
  return e.n <= MAX_IDENTIFY;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  if (!chatEnabled() || !process.env.CHAT_TOKEN_SECRET) return json({ ok: false }, 404);
  if (!allowed(clientIp(req))) return json({ ok: false, error: 'rate_limited' }, 429);

  let email = '';
  let phone = '';
  try {
    const text = await req.text();
    if (text.length > 2048) return json({ ok: false, error: 'bad_body' }, 400);
    const b = JSON.parse(text) as Record<string, unknown>;
    email = typeof b.email === 'string' ? b.email.trim() : '';
    phone = typeof b.phone === 'string' ? normalizePhone(b.phone) : '';
  } catch {
    return json({ ok: false, error: 'bad_body' }, 400);
  }
  if (!EMAIL_RE.test(email) || phone.replace(/\D/g, '').length < 10) return json({ ok: false, error: 'invalid' }, 400);

  try {
    const contactId = await findContactByEmailAndPhone(email, phone);
    if (!contactId) return json({ ok: false });
    const h = new Headers();
    h.append('Set-Cookie', `${CHAT_COOKIE}=${signChatToken(contactId)}; Path=/; Max-Age=${CHAT_TOKEN_TTL_S}; HttpOnly; Secure; SameSite=Lax`);
    return json({ ok: true }, 200, h);
  } catch (e) {
    console.error('[chat/identify] recherche GHL en échec:', e instanceof Error ? e.message : String(e));
    return json({ ok: false });
  }
}
