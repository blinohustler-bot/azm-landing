/* GET /api/chat/status — le chat est-il offert à CE visiteur ? { enabled, firstName? }.
 * 401 sans jeton valide : le widget ne s'affiche pas. */

import { chatEnabled, tylerConfigured, tylerFetch, visitorContact } from '@/lib/tyler';

export const dynamic = 'force-dynamic';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });

export async function GET(req: Request) {
  if (!chatEnabled() || !tylerConfigured()) return json({ enabled: false });
  const contactId = visitorContact(req);
  if (!contactId) return json({ error: 'unauthorized' }, 401);
  try {
    const up = await tylerFetch(`/api/webchat/status?contactId=${encodeURIComponent(contactId)}`);
    if (!up.ok) return json({ enabled: false });
    const d = (await up.json()) as { enabled?: boolean; firstName?: string };
    return json(d.enabled ? { enabled: true, firstName: d.firstName } : { enabled: false });
  } catch {
    return json({ enabled: false });
  }
}
