'use client';

import { useEffect } from 'react';
import { LANDING_KEY } from '@/lib/sendLead';

/* Retient l'URL d'arrivée, une fois par session.
 *
 * Le parcours reconstruit chaque lien à partir de zéro — `/?make=BMW`, puis
 * `/?make=BMW&model=m3` — donc la chaîne de départ disparaît dès le premier clic. Au
 * moment où la personne remplit le formulaire, `window.location.href` ne contient plus
 * un seul utm, et l'opportunité arrivait dans GHL sans aucune attribution : impossible
 * de savoir quelle pub a payé ce lead.
 *
 * On garde donc l'URL d'atterrissage telle quelle, en sessionStorage, et c'est elle
 * qu'on lit à l'envoi. sessionStorage et pas localStorage : une nouvelle visite, même
 * le lendemain, doit être attribuée à la pub qui l'a amenée cette fois-ci.
 */
export default function LandingCapture() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(LANDING_KEY)) return;   // déjà noté : on ne réécrit pas
      sessionStorage.setItem(LANDING_KEY, window.location.href);
    } catch { /* navigation privée : on se rabattra sur l'URL courante */ }
  }, []);
  return null;
}
