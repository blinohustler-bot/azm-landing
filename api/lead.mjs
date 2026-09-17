/* POST /api/lead — le lead de la landing fitment devient un contact + une opportunité
 * dans GoHighLevel.
 *
 * Pourquoi une fonction et pas un appel direct depuis la page : l'API GHL s'ouvre avec
 * un Private Integration token qui donne accès à tout le sous-compte. Un jeton posé
 * dans index.html est un jeton public. Il reste ici, dans process.env, et le navigateur
 * ne connaît que cette URL.
 *
 * Variables d'environnement (Vercel > Settings > Environment Variables) :
 *   GHL_API_KEY        requis   le PIT du sous-compte AZM (pit-…), scopes contacts + opportunities
 *   GHL_LOCATION_ID    requis   l'id du sous-compte
 *   GHL_PIPELINE_ID    optionnel  court-circuite la résolution par nom
 *   GHL_STAGE_ID       optionnel  idem
 *   GHL_PIPELINE_NAME  optionnel  sinon : le premier pipeline du sous-compte
 *   GHL_STAGE_NAME     optionnel  sinon : la première étape du pipeline
 *   ALLOWED_ORIGINS    optionnel  origines autorisées, séparées par des virgules
 *   LEAD_DEBUG         optionnel  "1" renvoie le détail d'erreur dans la réponse (staging)
 */

import { parseLead, splitName, opportunityName, noteBody } from '../lib/lead.mjs';
import {
  upsertContact, addNote, resolvePipeline,
  findOpenOpportunity, createOpportunity, updateOpportunity, GhlError
} from '../lib/ghl.mjs';

const MAX_BODY = 32 * 1024;      // un lead fait ~1 ko ; au-delà c'est autre chose
const MIN_FILL_MS = 2500;        // un humain ne remplit pas trois champs plus vite
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 40;   // toutes requêtes confondues, y compris les refusées
const MAX_WRITES = 6;      // celles qui écrivent réellement dans GHL

/* Limite de débit au mieux : la mémoire d'un lambda chaud, perdue au recyclage et non
   partagée entre instances. Ça n'arrête pas une attaque distribuée — ce n'est pas son
   rôle. Ça arrête le script d'un seul poste qui repost le formulaire en boucle, ce qui
   est la façon dont ce genre d'endpoint se fait salir en pratique.
   Deux compteurs, parce qu'ils protègent deux choses différentes : le premier borne le
   trafic, le second borne ce qui atteint le CRM. Un seul compteur forcerait à choisir
   entre laisser passer le bruit et bloquer dix minutes la personne qui s'est trompée
   cinq fois de numéro — et cette personne-là est justement le lead. */
const hits = new Map();
function bucket(ip) {
  const now = Date.now();
  for (const [k, v] of hits) if (now - v.start > WINDOW_MS) hits.delete(k);
  let e = hits.get(ip);
  if (!e || now - e.start > WINDOW_MS) { e = { start: now, reqs: 0, writes: 0 }; hits.set(ip, e); }
  return e;
}

function allowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || '')
    .split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);
}

/* Un Origin absent n'est pas un Origin refusé : des navigateurs et des extensions le
   retirent, et le rejeter coûterait de vrais leads. Un Origin présent et hors liste,
   lui, est une page tierce qui poste chez nous : on refuse. */
function originRejected(req) {
  const list = allowedOrigins();
  if (!list.length) return false;
  const origin = req.headers.origin;
  if (!origin) return false;
  return !list.includes(String(origin).replace(/\/$/, ''));
}

function readBody(req) {
  const b = req.body;
  if (b == null) return null;
  if (typeof b === 'object' && !Buffer.isBuffer(b)) return b;
  const text = Buffer.isBuffer(b) ? b.toString('utf8') : String(b);
  if (text.length > MAX_BODY) return null;
  try { return JSON.parse(text); } catch { return null; }
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  const list = allowedOrigins();
  if (origin && (!list.length || list.includes(String(origin).replace(/\/$/, '')))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (originRejected(req)) return res.status(403).json({ error: 'origin_not_allowed' });

  /* Vercel pose lui-même x-vercel-forwarded-for en bordure ; x-forwarded-for, lui,
     peut être forgé par le client. On préfère celui que l'infrastructure garantit. */
  const ip = String(req.headers['x-vercel-forwarded-for'] || req.headers['x-real-ip']
    || req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const quota = bucket(ip);
  quota.reqs += 1;
  if (quota.reqs > MAX_REQUESTS) return res.status(429).json({ error: 'rate_limited' });

  const body = readBody(req);
  if (!body) return res.status(400).json({ error: 'bad_body' });

  /* Piège à robots. Un formulaire rempli instantanément, ou dont le champ caché porte
     une valeur, n'a pas été rempli par la personne qu'on veut rappeler. On répond 200
     sans rien écrire dans GHL : un 403 apprendrait au script quoi contourner. */
  const elapsed = Number(body.elapsedMs);
  if (body.company || (Number.isFinite(elapsed) && elapsed < MIN_FILL_MS)) {
    console.log('[lead] écarté (piège à robots)', { ip, source: body.source });
    return res.status(200).json({ ok: true });
  }

  const { lead, error } = parseLead(body);
  if (error) return res.status(400).json({ error: 'invalid', field: error });

  /* Seuls les leads valides consomment le quota d'écriture : une frappe ratée sur le
     numéro de téléphone ne doit pas fermer la porte à la personne pour dix minutes. */
  quota.writes += 1;
  if (quota.writes > MAX_WRITES) {
    console.log("[lead] quota d'écriture atteint", { ip });
    return res.status(429).json({ error: 'rate_limited' });
  }

  try {
    const { firstName, lastName } = splitName(lead.name);
    const tags = ['fitment-lp', 'meta-ads'];
    if (lead.source === 'fitment_lp_not_listed') tags.push('hors-catalogue');
    if (lead.make) tags.push(lead.make.toLowerCase());

    const { id: contactId, isNew } = await upsertContact({
      firstName, lastName, email: lead.email, phone: lead.phone,
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
    let opportunityId;
    if (existing && existing.id) {
      opportunityId = await updateOpportunity(existing.id, { name, monetaryValue: lead.value });
    } else {
      opportunityId = await createOpportunity({
        name, pipelineId, stageId, contactId, monetaryValue: lead.value
      });
    }

    /* La note porte le détail du fitment. Elle ne doit jamais faire échouer le lead :
       le contact et l'opportunité, eux, sont déjà écrits. */
    try {
      await addNote(contactId, noteBody(lead));
    } catch (e) {
      console.error('[lead] note non écrite:', e.message);
    }

    console.log('[lead] ok', {
      source: lead.source, contactId, opportunityId,
      contactNew: isNew, reused: Boolean(existing && existing.id), value: lead.value
    });
    return res.status(200).json({ ok: true });
  } catch (e) {
    /* Le détail reste dans les logs Vercel. Le navigateur reçoit un code nu : un
       message d'upstream peut porter un id de sous-compte ou de pipeline. */
    const detail = e instanceof GhlError ? `GHL ${e.status}: ${e.message}` : String(e && e.message);
    console.error('[lead] échec:', detail);
    const out = { error: 'upstream' };
    if (process.env.LEAD_DEBUG === '1') out.detail = detail;
    return res.status(502).json(out);
  }
}
