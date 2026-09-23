'use client';

/* Le pixel Meta, derrière une seule porte.
 *
 * fbq n'existe qu'une fois le script tiers chargé (strategy afterInteractive) : chaque
 * appel doit donc supporter qu'il ne soit pas encore là. Un événement perdu vaut mieux
 * qu'une page cassée parce qu'un bloqueur de pub a retiré le script.
 */

type Fbq = (action: string, event: string, data?: Record<string, unknown>) => void;

declare global {
  interface Window { fbq?: Fbq }
}

/* Le premier écran se monte souvent avant que le script du pixel soit injecté : on
   patiente un peu (≈ 5 s) plutôt que de perdre l'étape 1, la plus importante de
   l'entonnoir. Au-delà, un bloqueur a probablement retiré le script — on abandonne. */
function send(action: 'track' | 'trackCustom', event: string, data?: Record<string, unknown>, tries = 20) {
  if (typeof window === 'undefined') return;
  if (typeof window.fbq !== 'function') {
    if (tries > 0) setTimeout(() => send(action, event, data, tries - 1), 250);
    return;
  }
  try { window.fbq(action, event, data ?? {}); } catch { /* jamais bloquant */ }
}

export function track(event: string, data?: Record<string, unknown>) {
  send('track', event, data);
}

/* Les événements maison (trackCustom) : Meta ne les optimise pas, mais ils servent
   d'audiences et de conversions personnalisées — ici, l'entonnoir étape par étape. */
export function trackCustom(event: string, data?: Record<string, unknown>) {
  send('trackCustom', event, data);
}
