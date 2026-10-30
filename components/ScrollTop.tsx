'use client';

import { useEffect } from 'react';

/* Ramène en haut de page à chaque nouvel écran.
 *
 * Les liens du parcours passent `scroll={false}`, donc Next garde la position du
 * défilement : un clic sur une marque tout en bas de la grille ouvrait l'écran 02
 * au niveau des avis, sous la liste des modèles. Monté avec la même `key` que
 * Track, il se rejoue quand l'écran change.
 */
export default function ScrollTop() {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);
  return null;
}
