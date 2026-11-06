/* POST /api/chat/turn — un tour de conversation avec Tyler, relayé en SSE.
 *
 * Corps du navigateur : { text: string | null, make, model, year? }. L'écran (voiture,
 * pièces, prix) est reconstruit ici avec le catalogue : il n'est jamais pris du client.
 * Tyler répond en flux ; on le relaie en assainissant ses évènements d'erreur. Si Tyler est injoignable, on répond quand
 * même 200 avec un flux { error } + { done }, pour que le widget affiche son repli.
 */

import { chatEnabled, clientIp, tylerConfigured, tylerFetch, turnAllowed, visitorContact } from '@/lib/tyler';
import { screenFor } from '@/lib/chatScreen';
import { SHOP } from '@/lib/catalog';
import { isShopUrl } from '@/lib/shopHost';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/* Un tour dure 25 à 45 s ; plafond de flux côté relais : 55 s (TIMEOUTS.total). */
export const maxDuration = 60;

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

/* Tyler émet des charges `data:` JSON sur UNE seule ligne ; un `data:` réparti sur
   plusieurs lignes n'est pas géré. */
/* Une proposition dont le lien ne vise pas le magasin est retirée du flux (le widget
   fait le même contrôle) : CHECKOUT y ajoute les coordonnées du visiteur. La ligne vide
   qui reste ne fait qu'un évènement vide, ignoré par le widget. */
function sanitizeLine(line: string): string {
  if (!line.startsWith('data:')) return line;
  try {
    const ev = JSON.parse(line.slice(5).trim());
    if (ev && ev.type === 'error') return GENERIC_ERROR;
    if (ev && ev.type === 'proposal' && !isShopUrl(ev.url, SHOP)) return '';
  } catch {
    /* ligne non JSON : telle quelle */
  }
  return line;
}

function sanitizeStream(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  const reader = body.getReader();
  let buf = '';
  let sawDone = false;
  let finished = false;

  const out = (lines: string[]) =>
    lines.map((l) => {
      const clean = sanitizeLine(l);
      if (clean.startsWith('data:') && clean.includes('"type":"done"')) sawDone = true;
      return clean;
    });
  /* Le flux s'est terminé ou est mort sans `done` : le widget doit quand même recevoir
     une erreur puis la fin, sinon son repli ne se déclenche jamais. */
  const ending = () => (sawDone ? '' : GENERIC_ERROR + '\n\ndata: {"type":"done"}\n\n');

  return new ReadableStream<Uint8Array>({
    async pull(ctl) {
      if (finished) return;
      try {
        const { done, value } = await reader.read();
        if (done) {
          buf += dec.decode();
          const tail = buf ? out([buf]).join('\n') + '\n\n' : '';
          finished = true;
          ctl.enqueue(enc.encode(tail + ending()));
          ctl.close();
          return;
        }
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        if (lines.length) ctl.enqueue(enc.encode(out(lines).join('\n') + '\n'));
      } catch {
        finished = true;
        const end = ending();
        if (end) ctl.enqueue(enc.encode(end));
        ctl.close();
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    }
  });
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
    }, 'turn');
    if (!up.ok || !up.body) return fallback();
    return new Response(sanitizeStream(up.body), { status: 200, headers: SSE_HEADERS });
  } catch {
    return fallback();
  }
}
