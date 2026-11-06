/* « Best seller », lu côté serveur uniquement.
 *
 * bestsellers.json est produit hors ligne par tools/build-bestsellers.mjs à partir
 * des commandes Shopify des 90 derniers jours. Il est livré VIDE tant que le script
 * n'a pas tourné avec un jeton Admin : `screens` ne contient rien, et le tag
 * n'apparaît nulle part. C'est voulu — un « best seller » qu'on ne peut pas prouver
 * par les ventes est une fausse indication.
 *
 * La clé est l'écran de résultats (marque | modèle | génération) : une pièce est la
 * plus vendue PARMI CELLES QUE LE VISITEUR A SOUS LES YEUX, pas dans l'absolu.
 */

import 'server-only';
import raw from '@/bestsellers.json';

const data = raw as unknown as { generated: string | null; screens: Record<string, string> };

/* La clé d'un écran, calculée de la même façon ici et dans le script. */
export const screenKey = (make: string, modelKey: string, genFrom: number | null) =>
  `${make}|${modelKey}|${genFrom ?? ''}`;

export function isBestSeller(handle: string, screen: string | null): boolean {
  return Boolean(screen && data.screens[screen] === handle);
}
