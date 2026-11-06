/* Les vidéos associées aux pièces, lues côté serveur uniquement.
 *
 * videos.json est produit par `node build-videos.mjs` à partir de l'inventaire de la
 * chaîne YouTube d'AZ. L'association produit → vidéo y est faite une fois, au build,
 * par une table écrite à la main (voir l'en-tête du script). Rien ici ne devine.
 *
 * Même garde que lib/catalog.ts : ProductCard est 'use client' et ne reçoit que la
 * vidéo de sa carte, jamais le fichier.
 */

import 'server-only';
import raw from '@/videos.json';
import type { CardVideo } from './cardMedia';

type Candidate = {
  id: string;
  label: string;
  /* Les modèles du catalogue pour lesquels la vidéo montre LE MÊME char. */
  models: string[];
  vertical: boolean;
  combo: boolean;
  title: string;
};

const videos = raw as unknown as { generated: string; products: Record<string, Candidate[]> };

/* La vidéo d'une pièce pour le char que le visiteur a choisi, ou null.
 *
 * Pas de repli sur « une vidéo de la même pièce sur un autre char ». La fiche S58
 * sert la M2, la M3 et la M4 : un propriétaire de M3 voit la G80, pas la G82, et
 * s'il n'existait que la G82, il ne verrait rien. Une vidéo d'un autre char que le
 * sien est exactement ce qu'une clientèle pointue relève. */
export function videoFor(handle: string, modelKey: string | null | undefined): CardVideo {
  if (!modelKey) return null;
  const hit = videos.products[handle]?.find((c) => c.models.includes(modelKey));
  return hit ? { id: hit.id, label: hit.label, vertical: hit.vertical } : null;
}
