/* Client GoHighLevel (LeadConnector) API v2 — le strict nécessaire pour la landing.
 *
 * Base https://services.leadconnectorhq.com, sans version dans l'hôte : la version est
 * un en-tête `Version` envoyé sur chaque appel. Auth : un Private Integration token
 * (pit-…) du sous-compte AZM, avec les scopes contacts + opportunities.
 *
 * Ce fichier ne tourne QUE côté serveur (fonction Vercel). Le jeton n'existe que dans
 * process.env et ne doit jamais se retrouver dans une réponse HTTP.
 */

const API_ROOT = 'https://services.leadconnectorhq.com';
const VERSION = process.env.GHL_API_VERSION || '2021-07-28';
const TIMEOUT_MS = 8000;

/* Chaque appel GHL est borné dans le temps : une fonction Vercel qui attend un
   upstream muet brûle sa durée max et le lead se perd en 504 plutôt qu'en erreur
   lisible. */
async function request(method, path, { query, body } = {}) {
  const token = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!token || !locationId) {
    throw new GhlError('GHL_API_KEY ou GHL_LOCATION_ID manquant', 0);
  }

  const url = new URL(API_ROOT + path);
  for (const [k, v] of Object.entries(query || {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.append(k, String(v));
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Version: VERSION,
    Accept: 'application/json'
  };
  const init = { method, headers, signal: AbortSignal.timeout(TIMEOUT_MS) };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, init);
  } catch (e) {
    throw new GhlError(`réseau: ${redact(String(e && e.message), token)}`, 0);
  }

  const text = await res.text();
  let parsed = null;
  if (text) { try { parsed = JSON.parse(text); } catch { parsed = null; } }

  if (!res.ok) {
    const msg = parsed && parsed.message;
    const detail = Array.isArray(msg) ? msg.join('; ') : (msg || text.slice(0, 300) || res.statusText);
    throw new GhlError(redact(detail, token), res.status);
  }
  return parsed || {};
}

export class GhlError extends Error {
  constructor(message, status) { super(message); this.name = 'GhlError'; this.status = status; }
}

/* Le jeton peut réapparaître dans un message d'erreur d'upstream ou de fetch ; on le
   coupe avant qu'il n'atteigne un log, qui lui est conservé et relu. */
function redact(s, token) {
  if (!s || !token) return s || '';
  return s.split(token).join('[redacted]');
}

/* ── contacts ───────────────────────────────────────────────────────────── */

/* upsert, jamais create : la page est publique, le même client revient, et un doublon
   de contact casse le pipeline et son reporting. GHL déduplique sur email/téléphone
   selon les réglages du sous-compte. */
export async function upsertContact({ firstName, lastName, name, email, phone, source, tags }) {
  const out = await request('POST', '/contacts/upsert', {
    body: {
      locationId: process.env.GHL_LOCATION_ID,
      firstName, lastName, name, email, phone,
      source: source || 'Fitment LP',
      tags: tags && tags.length ? tags : undefined
    }
  });
  const contact = out.contact || out;
  return { id: contact.id, isNew: out.new === true };
}

export async function addNote(contactId, body) {
  return request('POST', `/contacts/${encodeURIComponent(contactId)}/notes`, { body: { body } });
}

/* ── pipeline ───────────────────────────────────────────────────────────── */

/* Les ids de pipeline et d'étape ne s'inventent pas. Deux voies : les poser en
   variables d'environnement (un appel de moins), ou les résoudre par nom au premier
   lead. Le résultat est gardé en mémoire du lambda chaud — un déploiement ou un lambda
   froid le redemande, ce qui suffit à récupérer un pipeline renommé. */
let pipelineCache = null;

export async function resolvePipeline() {
  if (process.env.GHL_PIPELINE_ID && process.env.GHL_STAGE_ID) {
    return { pipelineId: process.env.GHL_PIPELINE_ID, stageId: process.env.GHL_STAGE_ID };
  }
  if (pipelineCache) return pipelineCache;

  const out = await request('GET', '/opportunities/pipelines', {
    query: { locationId: process.env.GHL_LOCATION_ID }
  });
  const pipelines = out.pipelines || [];
  if (!pipelines.length) throw new GhlError('aucun pipeline dans ce sous-compte', 0);

  const wantPipe = (process.env.GHL_PIPELINE_NAME || '').trim().toLowerCase();
  const pipeline = (wantPipe && pipelines.find((p) => String(p.name).trim().toLowerCase() === wantPipe))
    || pipelines[0];
  if (wantPipe && String(pipeline.name).trim().toLowerCase() !== wantPipe) {
    throw new GhlError(`pipeline "${process.env.GHL_PIPELINE_NAME}" introuvable`, 0);
  }

  const stages = (pipeline.stages || []).slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  if (!stages.length) throw new GhlError(`le pipeline "${pipeline.name}" n'a aucune étape`, 0);

  const wantStage = (process.env.GHL_STAGE_NAME || '').trim().toLowerCase();
  const stage = (wantStage && stages.find((s) => String(s.name).trim().toLowerCase() === wantStage))
    || stages[0];
  if (wantStage && String(stage.name).trim().toLowerCase() !== wantStage) {
    throw new GhlError(`étape "${process.env.GHL_STAGE_NAME}" introuvable dans "${pipeline.name}"`, 0);
  }

  pipelineCache = { pipelineId: pipeline.id, stageId: stage.id };
  return pipelineCache;
}

/* ── opportunités ───────────────────────────────────────────────────────── */

export async function findOpenOpportunity(contactId, pipelineId) {
  /* La version courante attend location_id, une plus ancienne locationId : on envoie
     les deux, comme le fait la skill ghl. */
  const out = await request('GET', '/opportunities/search', {
    query: {
      location_id: process.env.GHL_LOCATION_ID,
      locationId: process.env.GHL_LOCATION_ID,
      contactId, pipelineId, status: 'open', limit: 1
    }
  });
  const list = out.opportunities || [];
  return list.length ? list[0] : null;
}

export async function createOpportunity({ name, pipelineId, stageId, contactId, monetaryValue }) {
  const out = await request('POST', '/opportunities/', {
    body: {
      locationId: process.env.GHL_LOCATION_ID,
      pipelineId,
      pipelineStageId: stageId,
      contactId,
      name,
      status: 'open',
      monetaryValue: monetaryValue || undefined
    }
  });
  const opp = out.opportunity || out;
  return opp.id;
}

export async function updateOpportunity(opportunityId, { name, monetaryValue }) {
  await request('PUT', `/opportunities/${encodeURIComponent(opportunityId)}`, {
    body: { name, monetaryValue: monetaryValue || undefined }
  });
  return opportunityId;
}
