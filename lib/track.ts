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

export function track(event: string, data?: Record<string, unknown>) {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return;
  try { window.fbq('track', event, data ?? {}); } catch { /* jamais bloquant */ }
}
