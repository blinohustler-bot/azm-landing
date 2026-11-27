'use client';

import { CONFIG } from './config';

/* « Get an invoice · Text Tommy » (Sam, 27 nov. 2026).
 *
 * POURQUOI. Chez AZM, la vente se fait après une conversation : 15 factures (draft orders)
 * contre 5 commandes web du 28 oct. au 27 nov. Et 17 des 29 paniers LP abandonnés ont
 * quitté le checkout Shopify avant même d'entrer une adresse : 64 % des visiteurs sont
 * dans le navigateur d'Instagram, sans Apple Pay ni remplissage de carte.
 *
 * COMMENT. Le bouton ouvre le chat de l'écran des pièces avec la demande déjà écrite
 * (la pièce, l'option choisie). Tyler sait monter la facture Shopify et l'envoyer
 * (create_proposal → draftOrderInvoiceSend), et Tommy est prévenu des leads chauds.
 * Si le chat n'est pas sur la page (éteint, ou pas encore chargé), on retombe sur un
 * texto au numéro du magasin, avec le même message.
 */

export const INVOICE_EVENT = 'azm:invoice';

declare global {
  interface Window { __azmChatReady?: boolean }
}

export function requestInvoice(text: string) {
  if (typeof window === 'undefined') return;
  if (window.__azmChatReady) {
    window.dispatchEvent(new CustomEvent(INVOICE_EVENT, { detail: { text } }));
    return;
  }
  const num = CONFIG.PHONE_HREF.replace(/^tel:/, '');
  window.location.href = `sms:${num}?&body=${encodeURIComponent(text)}`;
}
