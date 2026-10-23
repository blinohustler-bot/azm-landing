/* Client Klaviyo — le lead de la landing devient un profil dans le compte Klaviyo du
 * magasin (TTmXFd, celui que le thème Shopify charge déjà).
 *
 * Le même compte que la boutique, et c'est tout l'intérêt : Klaviyo réconcilie par
 * courriel, donc la commande Shopify que ce lead passera plus tard atterrit sur ce
 * profil-là, avec le char et la provenance de la pub déjà dessus.
 *
 * Fait ici plutôt que par une automatisation GHL : chaque webhook de workflow GHL se
 * paie à l'exécution, cet appel-ci ne coûte rien.
 *
 * Deux appels :
 *   1. profile-import — crée ou met à jour le profil (Klaviyo déduplique sur le
 *      courriel) : nom, téléphone, et le char en propriétés.
 *   2. events — un événement « Fitment Lead », valeur = somme des pièces proposées.
 *      C'est lui qui déclenche un flow Klaviyo ; le profil seul ne déclenche rien.
 *   (+ l'ajout à une liste si KLAVIYO_LIST_ID est posé.)
 *
 * Aucun abonnement marketing n'est fait : le formulaire ne demande pas de
 * consentement. Le profil existe, il n'est pas inscrit à l'infolettre.
 *
 * Serveur seulement. La clé privée (pk_…) n'existe que dans process.env.
 */

import 'server-only';
import type { Lead } from './leadPayload';

const API_ROOT = process.env.KLAVIYO_API_ROOT || 'https://a.klaviyo.com/api';
const TIMEOUT_MS = 5000;
const revision = () => process.env.KLAVIYO_REVISION || '2024-10-15';

export const METRIC = 'Fitment Lead';

export const klaviyoEnabled = () => Boolean(process.env.KLAVIYO_API_KEY);

export class KlaviyoError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'KlaviyoError';
    this.status = status;
  }
}

async function request<T>(method: string, path: string, body: unknown): Promise<T> {
  const key = process.env.KLAVIYO_API_KEY;
  if (!key) throw new KlaviyoError('KLAVIYO_API_KEY manquant', 0);

  let res: Response;
  try {
    res = await fetch(API_ROOT + path, {
      method,
      headers: {
        Authorization: `Klaviyo-API-Key ${key}`,
        revision: revision(),
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json'
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new KlaviyoError(`réseau: ${msg.split(key).join('[redacted]')}`, 0);
  }

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try { parsed = JSON.parse(text); } catch { parsed = null; }
  }
  if (!res.ok) {
    /* Klaviyo répond en JSON:API : { errors: [{ detail, source: { pointer } }] }. Le
       pointeur dit quel champ a été refusé — c'est ce qui permet de reconnaître un
       téléphone invalide plus bas. */
    const errs = (parsed as { errors?: { detail?: string; source?: { pointer?: string } }[] } | null)?.errors;
    const detail = errs?.length
      ? errs.map((e) => [e.detail, e.source?.pointer].filter(Boolean).join(' @ ')).join('; ')
      : text.slice(0, 300) || res.statusText;
    throw new KlaviyoError(detail.split(key).join('[redacted]'), res.status);
  }
  return (parsed ?? {}) as T;
}

/* Ce que Klaviyo garde sur le profil. Écrasé à chaque passage : c'est le dernier char
   demandé qui compte pour la relance, l'historique complet vit dans GHL. */
function profileProperties(lead: Lead): Record<string, unknown> {
  const props: Record<string, unknown> = {
    fitment_source: lead.source,
    fitment_car: lead.car || undefined,
    fitment_make: lead.make || undefined,
    fitment_model: lead.model || undefined,
    fitment_generation: lead.generation || undefined,
    fitment_lead_at: lead.at
  };
  for (const [k, v] of Object.entries(lead.utms)) props[k] = v;
  return props;
}

async function importProfile(
  lead: Lead,
  name: { firstName: string; lastName: string },
  withPhone: boolean
): Promise<string | null> {
  const out = await request<{ data?: { id?: string } }>('POST', '/profile-import', {
    data: {
      type: 'profile',
      attributes: {
        email: lead.email,
        phone_number: withPhone && lead.phone ? lead.phone : undefined,
        first_name: name.firstName || undefined,
        last_name: name.lastName || undefined,
        properties: profileProperties(lead)
      }
    }
  });
  return out.data?.id ?? null;
}

export async function syncLeadToKlaviyo(
  lead: Lead,
  name: { firstName: string; lastName: string }
): Promise<{ profileId: string | null }> {
  /* Klaviyo refuse le profil ENTIER pour un téléphone qu'il juge invalide (un numéro
     hors Amérique du Nord mal formé, par exemple). Le courriel est ce qui compte : on
     réessaie sans téléphone plutôt que de perdre le profil. */
  let profileId: string | null;
  try {
    profileId = await importProfile(lead, name, true);
  } catch (e) {
    if (e instanceof KlaviyoError && e.status === 400 && /phone/i.test(e.message)) {
      console.warn('[klaviyo] téléphone refusé, profil créé sans:', e.message);
      profileId = await importProfile(lead, name, false);
    } else {
      throw e;
    }
  }

  const listId = process.env.KLAVIYO_LIST_ID;
  const tasks: Promise<unknown>[] = [
    request('POST', '/events', {
      data: {
        type: 'event',
        attributes: {
          metric: { data: { type: 'metric', attributes: { name: METRIC } } },
          profile: { data: { type: 'profile', attributes: { email: lead.email } } },
          value: lead.value || undefined,
          /* Un même lead rejoué (LeadRetry côté page, ou un double clic) ne doit pas
             déclencher deux fois le flow : Klaviyo ignore un unique_id déjà vu. Un
             autre char, ou le même char un autre jour, est un nouvel événement. */
          unique_id: `${lead.email}|${lead.car || lead.model}|${lead.at.slice(0, 10)}`,
          time: lead.at,
          properties: {
            source: lead.source,
            car: lead.car,
            make: lead.make,
            model: lead.model,
            generation: lead.generation,
            parts: lead.parts.map((p) => p.title),
            part_count: lead.parts.length,
            currency: 'CAD',
            landing: lead.landing,
            ...lead.utms
          }
        }
      }
    })
  ];
  /* L'ajout à une liste n'abonne pas : il range. Utile pour cibler ces leads dans une
     campagne ou un segment sans toucher à leur statut de consentement. */
  if (listId && profileId) {
    tasks.push(
      request('POST', `/lists/${encodeURIComponent(listId)}/relationships/profiles`, {
        data: [{ type: 'profile', id: profileId }]
      })
    );
  }
  const results = await Promise.allSettled(tasks);
  const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (failed.length) {
    throw new KlaviyoError(
      failed.map((f) => (f.reason instanceof Error ? f.reason.message : String(f.reason))).join(' | '),
      failed[0].reason instanceof KlaviyoError ? failed[0].reason.status : 0
    );
  }
  return { profileId };
}
