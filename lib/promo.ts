import { CONFIG } from '@/lib/config';

/* Le Black Friday d'AZM, réglé à l'heure près, sans redéploiement.
 *
 * Fenêtre : du 15 nov. 2026 à minuit, heure de l'Est, au 5 déc. 2026 à 23 h 59 HE
 * (Sam, 10 et 14 nov. 2026). Pendant la fenêtre, la livraison gratuite Canada + USA
 * passe de 1 000 $ à 900 $ et le bandeau du haut annonce la vente. À la fin, tout
 * revient tout seul à CONFIG.FREE_SHIP_MIN.
 *
 * Les bornes sont en UTC : novembre et décembre sont à l'heure normale de l'Est (UTC-5).
 *
 * La page est rendue à chaque requête (app/layout.tsx lit headers()), donc le serveur
 * bascule à la minute près. Côté navigateur, la même fonction lit l'horloge du visiteur :
 * un onglet ouvert à 23 h 50 bascule au prochain rendu, pas besoin de recharger tout.
 *
 * Les rabais 10/15/20 % ne sont pas calculés ici : Shopify les applique au checkout.
 * La page ne fait que les annoncer.
 */
export const BFCM = {
  START: Date.parse('2026-11-15T05:00:00Z'), // 15 nov. 00:00 HE
  END: Date.parse('2026-12-06T05:00:00Z'), //   6 déc. 00:00 HE (exclu) = fin le 5 à 23 h 59
  FREE_SHIP_MIN: 900,
  END_LABEL: 'Dec 5'
} as const;

export function isBfcm(now: number = Date.now()): boolean {
  return now >= BFCM.START && now < BFCM.END;
}

/* Les paliers que Shopify applique au checkout (sous-total CAD avant rabais). La page
   s'en sert pour dire « ajoute X $ pour 15 % », jamais pour calculer le prix payé. */
export const BF_TIERS = [
  { min: 0, pct: 10 },
  { min: 2000, pct: 15 },
  { min: 5000, pct: 20 }
] as const;

export function bfTier(subtotal: number) {
  let i = 0;
  for (let k = 0; k < BF_TIERS.length; k++) if (subtotal >= BF_TIERS[k].min) i = k;
  const next = BF_TIERS[i + 1] ?? null;
  return { pct: BF_TIERS[i].pct, next };
}

export function freeShipMin(now: number = Date.now()): number {
  return isBfcm(now) ? BFCM.FREE_SHIP_MIN : CONFIG.FREE_SHIP_MIN;
}
