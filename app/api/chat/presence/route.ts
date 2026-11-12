/* POST /api/chat/presence — « le visiteur est sur la page des résultats ». Au mieux :
 * 204 même si Tyler ne répond pas, le widget n'a rien à faire d'un échec ici. */

import { chatEnabled, tylerConfigured, tylerFetch, visitorContact } from '@/lib/tyler';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!chatEnabled()) return new Response(null, { status: 204 });
  if (!tylerConfigured()) return Response.json({ error: 'unavailable' }, { status: 503 });
  const contactId = visitorContact(req);
  if (!contactId) return Response.json({ error: 'unauthorized' }, { status: 401 });
  try {
    await tylerFetch('/api/webchat/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId })
    });
  } catch {
    /* au mieux */
  }
  return new Response(null, { status: 204 });
}
