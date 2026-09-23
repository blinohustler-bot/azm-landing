/* POST /api/lead — le lead de la landing fitment devient un contact + une opportunité
 * dans GoHighLevel.
 *
 * Pourquoi une route serveur et pas un appel direct depuis la page : l'API GHL s'ouvre
 * avec un Private Integration token qui donne accès à tout le sous-compte. Un jeton
 * posé dans le bundle client est un jeton public. Il reste ici, dans process.env, et le
 * navigateur ne connaît que cette URL.
 *
 * Variables d'environnement (Vercel > Settings > Environment Variables) :
 *   GHL_API_KEY        requis     le PIT du sous-compte AZM (pit-…), scopes contacts + opportunities
 *   GHL_LOCATION_ID    requis     l'id du sous-compte
 *   GHL_PIPELINE_ID    optionnel  court-circuite la résolution par nom
 *   GHL_STAGE_ID       optionnel  idem
 *   GHL_PIPELINE_NAME  optionnel  sinon : le premier pipeline du sous-compte
 *   GHL_STAGE_NAME     optionnel  sinon : la première étape du pipeline
 *   GHL_OPP_EMAIL_FIELD_ID  optionnel  id du champ {{opportunity.customer_email}} (sinon : par clé)
 *   ALLOWED_ORIGINS    optionnel  origines autorisées, séparées par des virgules
 *   LEAD_DEBUG         optionnel  "1" renvoie le détail d'erreur dans la réponse (préprod)
 */

import { parseLead, splitName, opportunityName, noteBody } from '@/lib/leadPayload';
import {
  upsertContact, addNote, resolvePipeline,
  findOpenOpportunity, createOpportunity, updateOpportunity, setOpportunityEmail, GhlError
} from '@/lib/ghl';

/* La route touche une API externe et un état en mémoire : rien à mettre en cache. */
export const dynamic = 'force-dynamic';

const MAX_BODY = 32 * 1024;      // un lead fait ~1 ko ; au-delà c'est autre chose
const MIN_FILL_MS = 2500;        // un humain ne remplit pas trois champs plus vite
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 40;   // toutes requêtes confondues, y compris les refusées
const MAX_WRITES = 6;      // celles qui écrivent réellement dans GHL

/* Limite de débit au mieux : la mémoire d'une instance chaude, perdue au recyclage et
   non partagée entre instances. Ça n'arrête pas une attaque distribuée — ce n'est pas
   son rôle. Ça arrête le script d'un seul poste qui repost le formulaire en boucle, ce
   qui est la façon dont ce genre d'endpoint se fait salir en pratique.
   Deux compteurs, parce qu'ils protègent deux choses différentes : le premier borne le
   trafic, le second borne ce qui atteint le CRM. Un seul compteur forcerait à choisir
   entre laisser passer le bruit et bloquer dix minutes la personne qui s'est trompée
   cinq fois de numéro — et cette personne-là est justement le lead. */
type Bucket = { start: number; reqs: number; writes: number };
const hits = new Map<string, Bucket>();

function bucket(ip: string): Bucket {
  const now = Date.now();
  for (const [k, v] of hits) if (now - v.start > WINDOW_MS) hits.delete(k);
  let e = hits.get(ip);
  if (!e || now - e.start > WINDOW_MS) {
    e = { start: now, reqs: 0, writes: 0 };
    hits.set(ip, e);
  }
  return e;
}

const allowedOrigins = () =>
  (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, '').toLowerCase())
    .filter(Boolean);

/* L'en-tête Origin porte toujours un schéma : « https://azm.ca », jamais « azm.ca ».
   Une liste écrite à la main, elle, contient volontiers « localhost:3000 » ou
   « fitment.azmotorsport.ca » — et la comparaison stricte n'aurait alors jamais
   correspondu. Le lead partait en 403, sans autre trace qu'un avertissement dans la
   console du visiteur : une campagne entière peut se vider comme ça.
   On accepte donc les deux écritures, en comparant aussi sur l'hôte (nom + port). */
function originAllowed(origin: string, list: string[]): boolean {
  const o = origin.replace(/\/+$/, '').toLowerCase();
  if (list.includes(o)) return true;
  try {
    return list.includes(new URL(origin).host.toLowerCase());
  } catch {
    return false;
  }
}

function corsHeaders(origin: string | null): Headers {
  const h = new Headers({
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store'
  });
  const list = allowedOrigins();
  if (origin && (!list.length || originAllowed(origin, list))) {
    h.set('Access-Control-Allow-Origin', origin);
    h.set('Vary', 'Origin');
  }
  return h;
}

/* Un Origin absent n'est pas un Origin refusé : des navigateurs et des extensions le
   retirent, et le rejeter coûterait de vrais leads. Un Origin présent et hors liste,
   lui, est une page tierce qui poste chez nous : on refuse. */
function originRejected(origin: string | null): boolean {
  const list = allowedOrigins();
  if (!list.length || !origin) return false;
  return !originAllowed(origin, list);
}

const json = (body: unknown, status: number, headers: Headers) =>
  new Response(JSON.stringify(body), {
    status,
    headers: (headers.set('Content-Type', 'application/json'), headers)
  });

export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) });
}

export async function POST(req: Request) {
  const origin = req.headers.get('origin');
  const headers = corsHeaders(origin);

  if (originRejected(origin)) return json({ error: 'origin_not_allowed' }, 403, headers);

  /* x-forwarded-for peut être forgé par le client ; x-vercel-forwarded-for est posé par
     la bordure de Vercel. On préfère celui que l'infrastructure garantit. */
  const ip =
    (req.headers.get('x-vercel-forwarded-for') ||
      req.headers.get('x-real-ip') ||
      req.headers.get('x-forwarded-for') ||
      '')
      .split(',')[0]
      .trim() || 'unknown';

  const quota = bucket(ip);
  quota.reqs += 1;
  if (quota.reqs > MAX_REQUESTS) return json({ error: 'rate_limited' }, 429, headers);

  /* On lit le texte avant de l'analyser : c'est ce qui rend le plafond de taille réel.
     Un JSON déjà désérialisé par le framework aurait été payé avant d'être refusé. */
  let body: Record<string, unknown>;
  try {
    const text = await req.text();
    if (!text || text.length > MAX_BODY) return json({ error: 'bad_body' }, 400, headers);
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return json({ error: 'bad_body' }, 400, headers);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: 'bad_body' }, 400, headers);
  }

  /* Piège à robots. Un formulaire rempli instantanément, ou dont le champ caché porte
     une valeur, n'a pas été rempli par la personne qu'on veut rappeler. On répond 200
     sans rien écrire dans GHL : un 403 apprendrait au script quoi contourner. */
  const elapsed = Number(body.elapsedMs);
  if (body.company || (Number.isFinite(elapsed) && elapsed < MIN_FILL_MS)) {
    console.log('[lead] écarté (piège à robots)', { ip, source: body.source });
    return json({ ok: true }, 200, headers);
  }

  const { lead, error } = parseLead(body);
  if (error || !lead) return json({ error: 'invalid', field: error }, 400, headers);

  /* Seuls les leads valides consomment le quota d'écriture : une frappe ratée sur le
     numéro de téléphone ne doit pas fermer la porte à la personne pour dix minutes. */
  quota.writes += 1;
  if (quota.writes > MAX_WRITES) {
    console.log("[lead] quota d'écriture atteint", { ip });
    return json({ error: 'rate_limited' }, 429, headers);
  }

  try {
    const { firstName, lastName } = splitName(lead.name);
    const tags = ['fitment-lp', 'meta-ads'];
    if (lead.source === 'fitment_lp_not_listed') tags.push('hors-catalogue');
    if (lead.make) tags.push(lead.make.toLowerCase());

    const { id: contactId, isNew } = await upsertContact({
      firstName,
      lastName,
      email: lead.email,
      phone: lead.phone,
      source: lead.utms.utm_source ? `${lead.utms.utm_source} — fitment LP` : 'Fitment LP',
      tags
    });
    if (!contactId) throw new GhlError('upsert sans contactId', 0);

    const { pipelineId, stageId } = await resolvePipeline();
    const name = opportunityName(lead);

    /* Le même client qui revient, ou qui essaie deux chars, ne doit pas produire deux
       deals ouverts dans la même colonne : on récupère l'opportunité ouverte et on la
       met à jour. La note, elle, s'ajoute à chaque passage — c'est l'historique. */
    const existing = await findOpenOpportunity(contactId, pipelineId);
    const opportunityId = existing?.id
      ? await updateOpportunity(existing.id, { name, monetaryValue: lead.value })
      : await createOpportunity({ name, pipelineId, stageId, contactId, monetaryValue: lead.value });

    /* Le courriel dans le champ {{opportunity.customer_email}}. Appel à part et non
       bloquant, comme la note : un champ mal nommé côté GHL ne doit pas coûter le lead. */
    if (opportunityId) {
      try {
        await setOpportunityEmail(opportunityId, lead.email);
      } catch (e) {
        console.error("[lead] courriel non recopié sur l'opportunité:",
          e instanceof GhlError ? `GHL ${e.status}: ${e.message}` : e instanceof Error ? e.message : String(e));
      }
    }

    /* La note porte le détail du fitment. Elle ne doit jamais faire échouer le lead :
       le contact et l'opportunité, eux, sont déjà écrits. */
    try {
      await addNote(contactId, noteBody(lead));
    } catch (e) {
      console.error('[lead] note non écrite:', e instanceof Error ? e.message : String(e));
    }

    console.log('[lead] ok', {
      source: lead.source,
      contactId,
      opportunityId,
      contactNew: isNew,
      reused: Boolean(existing?.id),
      value: lead.value
    });
    return json({ ok: true }, 200, headers);
  } catch (e) {
    /* Le détail reste dans les logs. Le navigateur reçoit un code nu : un message
       d'upstream peut porter un id de sous-compte ou de pipeline. */
    const detail =
      e instanceof GhlError ? `GHL ${e.status}: ${e.message}`
        : e instanceof Error ? e.message
        : String(e);
    console.error('[lead] échec:', detail);
    const out: Record<string, unknown> = { error: 'upstream' };
    if (process.env.LEAD_DEBUG === '1') out.detail = detail;
    return json(out, 502, headers);
  }
}
