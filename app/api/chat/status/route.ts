/* GET /api/chat/status — quel chat montrer à CE visiteur ?
 *
 * La bulle est TOUJOURS là sur l'écran des pièces dès que le chat est allumé (décision de
 * Sam, 12 nov. 2026 : vieux lead ou nouveau). Seul le mode change :
 *   { enabled: false }                       interrupteur éteint (CONFIG.TYLER_CHAT)
 *   { enabled: true, mode: 'identify' }      pas de jeton : le widget retrouve le contact
 *                                            (coordonnées gardées) ou les demande
 *   { enabled: true, mode: 'tyler' }         Tyler répond
 *   { enabled: true, mode: 'human' }         Tyler dit non pour ce fil (Tommy l'a, pause) :
 *                                            le message part quand même,
 *                                            Tyler le garde en note GHL et prévient Tommy
 */

import { chatEnabled, tylerConfigured, tylerFetch, visitorContact } from '@/lib/tyler';

export const dynamic = 'force-dynamic';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });

export async function GET(req: Request) {
  if (!chatEnabled()) return json({ enabled: false });
  const contactId = visitorContact(req);
  if (!contactId) return json({ enabled: true, mode: 'identify' });
  if (!tylerConfigured()) return json({ enabled: true, mode: 'human' });
  /* « human » seulement quand Tyler dit NON pour ce fil. Une vérification ratée (Tyler lent,
     500, réseau) laisse le mode Tyler : si Tyler est vraiment tombé, le premier tour
     échoue et le widget affiche le repli avec le numéro, comme avant. */
  try {
    const up = await tylerFetch(`/api/webchat/status?contactId=${encodeURIComponent(contactId)}`);
    if (!up.ok) return json({ enabled: true, mode: 'tyler' });
    const d = (await up.json()) as { enabled?: boolean; firstName?: string };
    const firstName = typeof d.firstName === 'string' ? d.firstName : undefined;
    return json({ enabled: true, mode: d.enabled === false ? 'human' : 'tyler', ...(firstName ? { firstName } : {}) });
  } catch {
    return json({ enabled: true, mode: 'tyler' });
  }
}
