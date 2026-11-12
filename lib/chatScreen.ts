/* L'écran que Tyler voit : la voiture et les pièces affichées au visiteur.
 *
 * Il est reconstruit ICI, avec le catalogue, à partir de make/model/year — les mêmes
 * valeurs d'URL que la page. On ne prend jamais l'écran tel que le navigateur l'envoie :
 * un visiteur pourrait y glisser un prix ou une pièce qui n'existent pas, et Tyler les
 * citerait comme vrais. Même logique que app/page.tsx pour l'étape des résultats.
 */

import 'server-only';
import { findMake, findModel, findGeneration, partsFor, carName } from '@/lib/catalog';

export type WebScreen = {
  car: string;
  parts: { productId: number; title: string; variants: { id: number; title: string; priceCAD: number }[] }[];
};

/* Tyler refuse plus de 8 pièces par écran (et 50 variantes par pièce). */
const MAX_PARTS = 8;
const MAX_VARIANTS = 50;

export function screenFor(make: string | undefined, model: string | undefined, year?: string): WebScreen | null {
  const mk = findMake(make);
  const md = findModel(mk?.make, model);
  if (!mk || !md) return null;
  const gen = findGeneration(md, year);
  const parts = partsFor(md, gen).slice(0, MAX_PARTS);
  if (!parts.length) return null;
  return {
    car: carName(mk.make, md, gen),
    parts: parts.map((p) => ({
      productId: p.id,
      title: p.title,
      variants: p.variants.slice(0, MAX_VARIANTS).map((v) => ({ id: v.id, title: v.title, priceCAD: v.price }))
    }))
  };
}
