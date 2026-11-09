'use client';

/* La conversion « lead » de Google Ads, derrière une seule porte.
 *
 * Appelée par lib/sendLead.ts UNIQUEMENT quand /api/lead a répondu OK. Même logique
 * que track.ts pour le pixel : gtag n'existe qu'une fois le script chargé (après
 * l'hydratation), donc on patiente un peu, et un bloqueur de pub ne doit jamais
 * casser la page.
 */

import { CONFIG, MIN_FILL_MS } from './config';

type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window { gtag?: Gtag }
}

/* +1XXXXXXXXXX, le format qu'attendent les conversions améliorées. Les leads sont
   canadiens ou américains : 10 chiffres = indicatif 1 ajouté. Autre chose qu'on ne
   sait pas lire avec certitude : on n'envoie rien plutôt qu'un numéro faux. */
export function toE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (raw.trim().startsWith('+') && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

function fire(email: string, phone: string | null, tries = 20) {
  if (typeof window === 'undefined') return;
  if (typeof window.gtag !== 'function') {
    if (tries > 0) setTimeout(() => fire(email, phone, tries - 1), 250);
    return;
  }
  try {
    /* Conversions améliorées : Google hache lui-même avant l'envoi. */
    const userData: Record<string, string> = {};
    if (email) userData.email = email;
    if (phone) userData.phone_number = phone;
    if (Object.keys(userData).length) window.gtag('set', 'user_data', userData);

    window.gtag('event', 'conversion', { send_to: CONFIG.GOOGLE_ADS_LEAD });
    window.gtag('event', 'generate_lead', { method: 'fitment_quiz' });
  } catch { /* jamais bloquant */ }
}

/* `body` = le JSON exact envoyé à /api/lead. */
export function reportLeadConversion(body: string) {
  if (!CONFIG.GOOGLE_ADS || !CONFIG.GOOGLE_ADS_LEAD) return;
  let lead: { email?: string; phone?: string; company?: string; elapsedMs?: number };
  try { lead = JSON.parse(body); } catch { return; }

  /* Le piège à robots de /api/lead répond 200 sans rien écrire dans GHL. Ce que le
     serveur jette ne doit pas devenir une conversion que Google optimise. */
  const elapsed = Number(lead.elapsedMs);
  if (lead.company || (Number.isFinite(elapsed) && elapsed < MIN_FILL_MS)) return;

  const email = (lead.email || '').trim().toLowerCase();
  fire(email, toE164(lead.phone || ''));
}
