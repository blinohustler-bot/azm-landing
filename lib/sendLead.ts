'use client';

/* L'envoi du lead vers /api/lead, côté navigateur.
 *
 * La règle qui gouverne ce fichier : on n'empêche jamais l'utilisateur d'avancer. La
 * requête part, on ne l'attend pas, et l'écran suivant s'affiche tout de suite — un
 * aller-retour vers GHL peut prendre deux secondes, et ce serait deux secondes volées
 * à la transition la plus importante du parcours.
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

/* Marque « ce visiteur a laissé ses coordonnées ».
 *
 * C'était localStorage, que seul le navigateur peut lire : au retour, le serveur
 * rendait donc le formulaire, et le client le remplaçait par les résultats une fois
 * hydraté — un aller-retour visible. Un cookie se lit côté serveur, donc la bonne page
 * arrive du premier coup.
 *
 * Ce n'est pas une barrière de sécurité, et ça ne l'a jamais été : le gate est un
 * dispositif de conversion. Rien de sensible ne dépend de ce cookie.
 */
export const LEAD_COOKIE = 'azm_lead';

function markKnown() {
  try {
    const maxAge = 60 * 60 * 24 * 90; // 90 jours
    document.cookie = `${LEAD_COOKIE}=1; path=/; max-age=${maxAge}; SameSite=Lax`;
  } catch { /* cookies refusés : le parcours marche quand même */ }
}

export function sendLead(payload: LeadPayload) {
  markKnown();

  const body = JSON.stringify(payload);
  /* Copie locale : si l'envoi échoue, le lead n'est pas perdu pour l'équipe qui ouvre
     la console sur un appareil de test. */
  try { localStorage.setItem('azm_lead', body); } catch { /* navigation privée */ }

  /* keepalive survit à la navigation qui suit immédiatement. */
  fetch('/api/lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
    credentials: 'omit'
  })
    .then((r) => {
      if (!r.ok) console.warn(`[AZM] lead refusé par /api/lead — HTTP ${r.status}`);
    })
    .catch(() => { /* on n'empêche jamais l'utilisateur d'avancer */ });
}

/* ── validation ──────────────────────────────────────────────────────────── */

export const okEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v.trim());
export const okPhone = (v: string) => v.replace(/\D/g, '').length >= 10;
export const okName = (v: string) => v.trim().length > 1;
