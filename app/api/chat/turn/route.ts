/* POST /api/chat/turn — un tour de conversation avec Tyler, relayé en SSE.
 *
 * Corps du navigateur : { text: string | null, make, model, year? }. L'écran (voiture,
 * pièces, prix) est reconstruit ici avec le catalogue : il n'est jamais pris du client.
 * Tyler répond en flux ; on le relaie en assainissant ses évènements d'erreur. Si Tyler est injoignable, on répond quand
 * même 200 avec un flux { error } + { done }, pour que le widget affiche son repli.
 */

import { chatEnabled, clientIp, tylerConfigured, tylerFetch, turnAllowed, visitorContact } from '@/lib/tyler';
import { screenFor } from '@/lib/chatScreen';

export const dynamic = 'force-dynamic';

const MAX_TEXT = 1000;
const MAX_BODY = 8 * 1024;

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  'X-Accel-Buffering': 'no'
};

const bad = (status: number, error: string) => Response.json({ error }, { status });

const fallback = () =>
  new Response('data: {"type":"error","message":"unreachable"}\n\ndata: {"type":"done"}\n\n', {
    status: 200,
    headers: SSE_HEADERS
  });

/* Relaie le flux SSE de Tyler ligne à ligne, en continu (rien n'est mis en tampon au-delà
   d'une ligne). Tout évènement { type: "error" } est remplacé par l'erreur générique : le
   détail d'une panne de Tyler ne doit pas atteindre le navigateur. Les autres passent
   tels quels. */
const GENERIC_ERROR = 'data: {"type":"error","message":"unreachable"}';

function sanitizeLine(line: string): string {
  if (!line.startsWith('data:')) return line;
  try {
    const ev = JSON.parse(line.slice(5).trim());
    if (ev && ev.type === 'error') return GENERIC_ERROR;
  } catch {
    /* ligne non JSON : telle quelle */
  }
  return line;
}

function sanitizeStream(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  let buf = '';
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, ctl) {
        buf += dec.decode(chunk, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        if (lines.length) ctl.enqueue(enc.encode(lines.map(sanitizeLine).join('\n') + '\n'));
      },
      flush(ctl) {
        buf += dec.decode();
        if (buf) ctl.enqueue(enc.encode(sanitizeLine(buf)));
      }
    })
  );
}

export async function POST(req: Request) {
  if (!chatEnabled() || !tylerConfigured()) return bad(503, 'unavailable');
  const contactId = visitorContact(req);
  if (!contactId) return bad(401, 'unauthorized');
  if (!turnAllowed(clientIp(req))) return bad(429, 'rate_limited');

  const raw = await req.text();
  if (raw.length > MAX_BODY) return bad(400, 'bad_request');
  let b: unknown;
  try {
    b = JSON.parse(raw);
  } catch {
    return bad(400, 'bad_request');
  }
  const o = (b && typeof b === 'object' ? b : {}) as Record<string, unknown>;
  const { text, make, model, year } = o;
  if (text !== null && typeof text !== 'string') return bad(400, 'bad_request');
  if (typeof text === 'string' && text.length > MAX_TEXT) return bad(400, 'text_too_long');
  if (typeof make !== 'string' || typeof model !== 'string') return bad(400, 'bad_request');
  if (year !== undefined && typeof year !== 'string') return bad(400, 'bad_request');

  const screen = screenFor(make, model, year);
  if (!screen) return bad(400, 'unknown_car');

  try {
    const up = await tylerFetch('/api/webchat/turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId, text: text ?? null, screen })
    });
    if (!up.ok || !up.body) return fallback();
    return new Response(sanitizeStream(up.body), { status: 200, headers: SSE_HEADERS });
  } catch {
    return fallback();
  }
}
