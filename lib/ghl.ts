/* Client GoHighLevel (LeadConnector) API v2 — le strict nécessaire pour la landing.
 *
 * Base https://services.leadconnectorhq.com, sans version dans l'hôte : la version est
 * un en-tête `Version` envoyé sur chaque appel. Auth : un Private Integration token
 * (pit-…) du sous-compte AZM, avec les scopes contacts + opportunities.
 *
 * Ce fichier ne tourne QUE côté serveur. Le jeton n'existe que dans process.env et ne
 * doit jamais se retrouver dans une réponse HTTP.
 */

import 'server-only';

/* GHL_API_ROOT permet de viser un bouchon local au lieu du vrai sous-compte : c'est ce
   qui rend le parcours vérifiable de bout en bout sans écrire un faux contact dans le
   CRM de production. Non renseigné — le cas normal, et celui de Vercel — c'est la vraie
   API. */
const API_ROOT = process.env.GHL_API_ROOT || 'https://services.leadconnectorhq.com';
const TIMEOUT_MS = 8000;

const version = () => process.env.GHL_API_VERSION || '2021-07-28';

export class GhlError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'GhlError';
    this.status = status;
  }
}

/* Le jeton peut réapparaître dans un message d'erreur d'upstream ou de fetch ; on le
   coupe avant qu'il n'atteigne un log, qui lui est conservé et relu. */
function redact(s: string, token: string): string {
  if (!s || !token) return s || '';
  return s.split(token).join('[redacted]');
}

type RequestOpts = {
  query?: Record<string, string | number | undefined>;
  body?: unknown;
};

/* Chaque appel GHL est borné dans le temps : une fonction qui attend un upstream muet
   brûle sa durée max, et le lead se perd en 504 plutôt qu'en erreur lisible. */
async function request<T>(method: string, path: string, opts: RequestOpts = {}): Promise<T> {
  const token = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!token || !locationId) {
    throw new GhlError('GHL_API_KEY ou GHL_LOCATION_ID manquant', 0);
  }

  const url = new URL(API_ROOT + path);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.append(k, String(v));
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Version: version(),
    Accept: 'application/json'
  };
  const init: RequestInit = { method, headers, signal: AbortSignal.timeout(TIMEOUT_MS) };
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new GhlError(`réseau: ${redact(msg, token)}`, 0);
  }

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try { parsed = JSON.parse(text); } catch { parsed = null; }
  }

  if (!res.ok) {
    const msg = (parsed as { message?: string | string[] } | null)?.message;
    const detail = Array.isArray(msg)
      ? msg.join('; ')
      : msg || text.slice(0, 300) || res.statusText;
    throw new GhlError(redact(detail, token), res.status);
  }
  return (parsed ?? {}) as T;
}

/* ── contacts ───────────────────────────────────────────────────────────── */

export type UpsertResult = { id: string | null; isNew: boolean };

/* upsert, jamais create : la page est publique, le même client revient, et un doublon
   de contact casse le pipeline et son reporting. GHL déduplique sur email/téléphone
   selon les réglages du sous-compte. */
export async function upsertContact(input: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  source: string;
  tags: string[];
}): Promise<UpsertResult> {
  const out = await request<{ new?: boolean; contact?: { id?: string }; id?: string }>(
    'POST',
    '/contacts/upsert',
    {
      body: {
        locationId: process.env.GHL_LOCATION_ID,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        source: input.source || 'Fitment LP',
        tags: input.tags.length ? input.tags : undefined
      }
    }
  );
  return { id: out.contact?.id ?? out.id ?? null, isNew: out.new === true };
}

export async function addNote(contactId: string, body: string) {
  return request<unknown>('POST', `/contacts/${encodeURIComponent(contactId)}/notes`, {
    body: { body }
  });
}

/* ── pipeline ───────────────────────────────────────────────────────────── */

export type PipelineTarget = { pipelineId: string; stageId: string };

type Stage = { id: string; name: string; position?: number };
type Pipeline = { id: string; name: string; stages?: Stage[] };

/* Les ids de pipeline et d'étape ne s'inventent pas. Deux voies : les poser en
   variables d'environnement (un appel de moins), ou les résoudre par nom au premier
   lead. Le résultat est gardé en mémoire de l'instance chaude — un déploiement ou une
   instance froide le redemande, ce qui suffit à récupérer un pipeline renommé. */
let pipelineCache: PipelineTarget | null = null;

export function resetPipelineCache() {
  pipelineCache = null;
}

export async function resolvePipeline(): Promise<PipelineTarget> {
  if (process.env.GHL_PIPELINE_ID && process.env.GHL_STAGE_ID) {
    return { pipelineId: process.env.GHL_PIPELINE_ID, stageId: process.env.GHL_STAGE_ID };
  }
  if (pipelineCache) return pipelineCache;

  const out = await request<{ pipelines?: Pipeline[] }>('GET', '/opportunities/pipelines', {
    query: { locationId: process.env.GHL_LOCATION_ID }
  });
  const pipelines = out.pipelines ?? [];
  if (!pipelines.length) throw new GhlError('aucun pipeline dans ce sous-compte', 0);

  const lower = (v: string | undefined) => (v ?? '').trim().toLowerCase();

  const wantPipe = lower(process.env.GHL_PIPELINE_NAME);
  const pipeline = (wantPipe && pipelines.find((p) => lower(p.name) === wantPipe)) || pipelines[0];
  if (wantPipe && lower(pipeline.name) !== wantPipe) {
    throw new GhlError(`pipeline "${process.env.GHL_PIPELINE_NAME}" introuvable`, 0);
  }

  const stages = (pipeline.stages ?? []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  if (!stages.length) throw new GhlError(`le pipeline "${pipeline.name}" n'a aucune étape`, 0);

  const wantStage = lower(process.env.GHL_STAGE_NAME);
  const stage = (wantStage && stages.find((s) => lower(s.name) === wantStage)) || stages[0];
  if (wantStage && lower(stage.name) !== wantStage) {
    throw new GhlError(`étape "${process.env.GHL_STAGE_NAME}" introuvable dans "${pipeline.name}"`, 0);
  }

  pipelineCache = { pipelineId: pipeline.id, stageId: stage.id };
  return pipelineCache;
}

/* ── opportunités ───────────────────────────────────────────────────────── */

export type Opportunity = { id: string; name?: string };

export async function findOpenOpportunity(
  contactId: string,
  pipelineId: string
): Promise<Opportunity | null> {
  /* La version courante attend location_id, une plus ancienne locationId : on envoie
     les deux, comme le fait la skill ghl. */
  const out = await request<{ opportunities?: Opportunity[] }>('GET', '/opportunities/search', {
    query: {
      location_id: process.env.GHL_LOCATION_ID,
      locationId: process.env.GHL_LOCATION_ID,
      contactId,
      pipelineId,
      status: 'open',
      limit: 1
    }
  });
  const list = out.opportunities ?? [];
  return list.length ? list[0] : null;
}

export async function createOpportunity(input: {
  name: string;
  pipelineId: string;
  stageId: string;
  contactId: string;
  monetaryValue: number;
}): Promise<string | null> {
  const out = await request<{ opportunity?: { id?: string }; id?: string }>(
    'POST',
    '/opportunities/',
    {
      body: {
        locationId: process.env.GHL_LOCATION_ID,
        pipelineId: input.pipelineId,
        pipelineStageId: input.stageId,
        contactId: input.contactId,
        name: input.name,
        status: 'open',
        monetaryValue: input.monetaryValue || undefined
      }
    }
  );
  return out.opportunity?.id ?? out.id ?? null;
}

export async function updateOpportunity(
  opportunityId: string,
  input: { name: string; monetaryValue: number }
): Promise<string> {
  await request<unknown>('PUT', `/opportunities/${encodeURIComponent(opportunityId)}`, {
    body: { name: input.name, monetaryValue: input.monetaryValue || undefined }
  });
  return opportunityId;
}
