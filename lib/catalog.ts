/* Le catalogue, typé, lu côté serveur uniquement.
 *
 * `catalog.json` fait 360 ko. Il ne descend jamais dans le navigateur : chaque écran
 * ne reçoit que la tranche qu'il affiche — neuf marques ici, une trentaine de modèles
 * là, deux produits sur l'écran de résultats.
 *
 * Ce n'est pas une économie de poids nette : mesuré, le temps d'exécution de React
 * coûte plus cher que ne coûtait le catalogue, qui se compressait très bien (273 ko
 * bruts, 28 ko gzip). Ce que ça achète, c'est que le premier écran arrive en HTML —
 * la page statique n'affichait rien tant que le catalogue n'était pas téléchargé,
 * analysé et exécuté.
 *
 * `import 'server-only'` est la garde : un composant 'use client' qui importerait ce
 * fichier casse le build au lieu d'embarquer silencieusement les 360 ko. Ce qui est
 * déjà arrivé une fois — voir lib/catalogTypes.ts.
 *
 * Régénéré par `node build-index.mjs` depuis products.json de Shopify.
 */

import 'server-only';
import raw from '@/catalog.json';

/* Les types et les fonctions pures vivent à côté, pour rester importables depuis un
   composant client. On les réexporte pour que le serveur n'ait qu'un import. */
export type {
  Generation, Model, Make, Variant, PartKind, Product, Catalog
} from './catalogTypes';
export { fitmentLines, partLabel, money, slugify } from './catalogTypes';

import type { Catalog, Generation, Make, Model, Product } from './catalogTypes';
import { slugify } from './catalogTypes';

const catalog = raw as unknown as Catalog;

export const SHOP = catalog.shop || 'https://azmotorsport.ca';
export const GENERATED = catalog.generated;

/* ── comptes affichés sur l'écran d'accueil ──────────────────────────────── */

export const partCount = Object.keys(catalog.products).length;
export const modelCount = catalog.makes.reduce((s, m) => s + m.models.length, 0);

/* ── marques ─────────────────────────────────────────────────────────────── */

export type MakeCard = { make: string; slug: string; parts: number };



/* Catalogues les plus profonds en premier : la première rangée doit contenir les
   marques qui couvrent le plus de visiteurs, pas l'ordre alphabétique. */
export function makeCards(): MakeCard[] {
  return catalog.makes
    .map((m) => ({
      make: m.make,
      slug: slugify(m.make),
      parts: m.models.reduce((s, x) => s + x.products.length, 0)
    }))
    .sort((a, b) => b.parts - a.parts);
}

/* Anciens noms encore présents dans des liens déjà publiés (pubs, courriels). */
const MAKE_RENAMED: Record<string, string> = { chevrolet: 'corvette' };

export function findMake(name: string | undefined): Make | null {
  if (!name) return null;
  const lower = name.toLowerCase();
  const want = MAKE_RENAMED[lower] ?? lower;
  return catalog.makes.find((m) => m.make.toLowerCase() === want) ?? null;
}

export function findModel(makeName: string | undefined, key: string | undefined): Model | null {
  const make = findMake(makeName);
  if (!make || !key) return null;
  return make.models.find((m) => m.key === key) ?? null;
}

/* La génération est identifiée dans l'URL par son année de début : c'est ce que les
   deep links de campagne portent déjà (?year=2015). */
export function findGeneration(model: Model | null, from: string | undefined): Generation | null {
  if (!model || !from) return null;
  const n = Number(from);
  if (!Number.isFinite(n)) return null;
  return model.generations.find((g) => g.from === n) ?? null;
}

/* ── pièces ──────────────────────────────────────────────────────────────── */

/* Les pièces d'une génération quand elle est connue, sinon toutes celles du modèle.
   Triées par type puis par prix : deux downpipes se comparent entre eux avant de se
   comparer à une ligne d'échappement complète. */
export function partsFor(model: Model | null, gen: Generation | null): Product[] {
  if (!model) return [];
  const ids = gen ? gen.products : model.products;
  return ids
    .map((id) => catalog.products[String(id)])
    .filter(Boolean)
    .sort((a, b) => a.part.localeCompare(b.part) || a.price - b.price);
}

export function generationLabel(g: Generation | null): string {
  if (!g) return '';
  return `${g.from}–${g.to}${g.chassis ? ` · ${g.chassis}` : ''}`;
}

export function carName(makeName: string | null, model: Model | null, gen: Generation | null): string {
  const base = [makeName, model?.label].filter(Boolean).join(' ');
  return gen ? `${base} (${generationLabel(gen)})` : base;
}


export default catalog;
