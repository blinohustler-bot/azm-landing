/* L'A/B en cours, en un seul endroit.
 *
 * Pas de 'use client' ici, pour la même raison que LEAD_COOKIE dans config.ts : le
 * proxy, la page serveur, la route /api/lead et le pixel côté navigateur doivent tous
 * lire la vraie valeur, pas une référence de module.
 *
 * Le principe : le proxy tire une version au hasard à la première visite et la pose
 * dans un cookie. Le visiteur garde sa version tant que l'expérience dure. La version
 * part ensuite partout où un résultat se mesure :
 *   - chaque événement du pixel Meta porte `ab` (FormStep, Lead, AddToCart…) ;
 *   - le contact GHL reçoit le tag `ab-<id>-<version>` ;
 *   - Clarity reçoit `ab` en variable de session, pour filtrer heatmaps et sessions.
 *
 * On juge sur le coût par lead SERVABLE dans GHL, pas sur le nombre de leads. Un test
 * a besoin de volume : compter trois à quatre semaines à ~100 leads/mois, et ne
 * tester qu'une grosse différence à la fois.
 *
 * Pour lancer un test : donner un `id` NEUF (jamais réutiliser un ancien, sinon les
 * vieux cookies se mélangent aux nouveaux) et ses versions. `null` = aucun test, la
 * page sert la version A à tout le monde et rien n'est tagué.
 */

export type Experiment = {
  id: string;
  variants: readonly string[];
};

export const EXPERIMENT: Experiment | null = null;

export const AB_COOKIE = 'azm_ab';

/* 90 jours : plus long que n'importe quel test, et un visiteur qui revient d'une
   deuxième pub doit retomber sur la même version. */
export const AB_MAX_AGE = 60 * 60 * 24 * 90;

/* La valeur du cookie est « <id>-<version> ». Un cookie d'une ancienne expérience,
   ou bricolé à la main, ne correspond pas et vaut null. */
export function abValue(cookie: string | undefined | null): string | null {
  if (!EXPERIMENT || !cookie) return null;
  const prefix = `${EXPERIMENT.id}-`;
  if (!cookie.startsWith(prefix)) return null;
  return EXPERIMENT.variants.includes(cookie.slice(prefix.length)) ? cookie : null;
}

/* La version seule (« A », « B »), pour décider quoi afficher. Sans test : « A ». */
export function abVariant(cookie: string | undefined | null): string {
  const v = abValue(cookie);
  return v && EXPERIMENT ? v.slice(EXPERIMENT.id.length + 1) : 'A';
}

export function drawAb(): string | null {
  if (!EXPERIMENT || !EXPERIMENT.variants.length) return null;
  const i = Math.floor(Math.random() * EXPERIMENT.variants.length);
  return `${EXPERIMENT.id}-${EXPERIMENT.variants[i]}`;
}
