'use client';

/* L'envoi du lead vers /api/lead, côté navigateur.
 *
 * L'opportunité GHL doit exister à partir du moment où la personne a laissé ses
 * coordonnées — c'est-à-dire à l'étape 04, avant que les pièces ne s'affichent. Elle
 * peut très bien regarder les pièces et partir : si l'écriture n'a pas eu lieu à ce
 * moment-là, le lead est perdu alors qu'il était acquis.
 *
 * L'envoi était donc parti sans être attendu, et personne ne savait s'il arrivait. Ce
 * fichier tient maintenant trois promesses :
 *   1. on attend la réponse (bornée), donc on sait ;
 *   2. un envoi qui échoue est conservé et repris au chargement suivant ;
 *   3. on ne bloque jamais la personne — au pire elle passe aux pièces pendant que la
 *      reprise se débrouille.
 *
 * La reprise est sans danger : /api/lead fait un upsert du contact et met à jour
 * l'opportunité ouverte existante au lieu d'en créer une seconde. Rejouer le même
 * envoi ne peut pas produire de doublon.
 */

export type LeadPayload = {
  source: 'fitment_lp' | 'fitment_lp_not_listed';
  name: string;
  email: string;
  phone: string;
  car?: string;
  make?: string | null;
  model?: string | null;
  generation?: string | null;
  parts?: { title: string; price: number }[];
  page: string;
  elapsedMs: number;
  company: string;
};

/* Au-delà, on rend la main à la personne et la reprise prend le relais. Un aller-retour
   vers GHL prend environ une seconde ; cinq laissent de la marge sans faire attendre
   devant un écran qui ne bouge pas. */
const SEND_TIMEOUT_MS = 5000;

const PENDING_KEY = 'azm_lead_pending';
export const LEAD_COOKIE = 'azm_lead';

/* Marque « ce visiteur est dans GHL ».
 *
 * Un cookie, donc lisible côté serveur : au retour, la bonne page arrive du premier
 * coup, sans le formulaire qui clignote le temps que le navigateur lise son
 * localStorage.
 *
 * Il n'est posé QUE sur un envoi confirmé. Il l'était auparavant avant même la
 * requête : un premier envoi raté marquait la personne comme connue à vie, elle ne
 * revoyait jamais le formulaire, et elle n'entrait donc jamais dans GHL.
 *
 * Ce n'est pas une barrière de sécurité, et ça ne l'a jamais été : le gate est un
 * dispositif de conversion.
 */
function markKnown() {
  try {
    const maxAge = 60 * 60 * 24 * 90; // 90 jours
    document.cookie = `${LEAD_COOKIE}=1; path=/; max-age=${maxAge}; SameSite=Lax`;
  } catch { /* cookies refusés : le parcours marche quand même */ }
}

const readPending = () => {
  try { return localStorage.getItem(PENDING_KEY); } catch { return null; }
};
const writePending = (body: string) => {
  try { localStorage.setItem(PENDING_KEY, body); } catch { /* navigation privée */ }
};
const clearPending = () => {
  try { localStorage.removeItem(PENDING_KEY); } catch { /* idem */ }
};

async function postOnce(body: string): Promise<boolean> {
  try {
    const res = await fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      /* keepalive : si la personne ferme l'onglet juste après, la requête part quand
         même. */
      keepalive: true,
      credentials: 'omit',
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS)
    });
    if (res.ok) return true;
    /* 4xx = ce corps ne passera jamais, inutile de le rejouer indéfiniment. Seuls les
       429 et les 5xx méritent une reprise. */
    if (res.status >= 400 && res.status < 500 && res.status !== 429) {
      console.warn(`[AZM] lead refusé définitivement — HTTP ${res.status}`);
      clearPending();
      return false;
    }
    console.warn(`[AZM] lead non écrit — HTTP ${res.status}, reprise plus tard`);
    return false;
  } catch {
    console.warn('[AZM] lead non écrit — réseau ou délai dépassé, reprise plus tard');
    return false;
  }
}

/* Attend la réponse, mais jamais plus que SEND_TIMEOUT_MS. Rend `true` si
   l'opportunité est écrite. */
export async function sendLead(payload: LeadPayload): Promise<boolean> {
  const body = JSON.stringify(payload);

  /* Consigné AVANT la tentative : un onglet fermé au mauvais moment ne doit pas
     emporter le lead avec lui. */
  writePending(body);
  try { localStorage.setItem('azm_lead', body); } catch { /* navigation privée */ }

  const ok = await postOnce(body);
  if (ok) {
    clearPending();
    markKnown();
  }
  return ok;
}

/* Rejoue le dernier envoi resté en carafe. Appelé au montage de l'écran suivant, donc
   quelques secondes après l'échec, et à chaque visite ultérieure. */
export async function flushPendingLead(): Promise<boolean> {
  const body = readPending();
  if (!body) return true;
  const ok = await postOnce(body);
  if (ok) {
    clearPending();
    markKnown();
  }
  return ok;
}

/* ── validation ──────────────────────────────────────────────────────────── */

export const okEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v.trim());
export const okPhone = (v: string) => v.replace(/\D/g, '').length >= 10;
export const okName = (v: string) => v.trim().length > 1;
