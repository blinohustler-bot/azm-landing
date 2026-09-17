/* Les types du catalogue et les fonctions qui n'en lisent aucune donnée.
 *
 * Séparés de lib/catalog.ts pour une raison précise : ce fichier-ci est importable
 * par un composant client, l'autre non. lib/catalog.ts fait `import raw from
 * '@/catalog.json'` — le moindre import depuis un fichier 'use client' embarquerait
 * les 360 ko du catalogue dans le bundle du navigateur. C'est exactement ce qui est
 * arrivé une première fois : ProductCard importait fitmentLines d'ici, et le catalogue
 * se retrouvait dans un chunk client de 42 ko gzip.
 *
 * lib/catalog.ts porte `import 'server-only'` pour que la régression casse le build
 * au lieu de passer inaperçue.
 */

export type Generation = {
  from: number;
  to: number;
  /* Code châssis (F80, 991.2…). Vide sur 74 des générations : Shopify ne le donne pas
     partout, et l'affichage retombe alors sur le nombre de pièces. */
  chassis: string;
  products: number[];
};

export type Model = {
  key: string;
  label: string;
  fits: string[];
  years: [number, number] | null;
  products: number[];
  generations: Generation[];
};

export type Make = {
  make: string;
  image: string;
  models: Model[];
};

export type Variant = {
  id: number;
  title: string;
  price: number;
  available: boolean;
  options: string[];
};

export type PartKind = 'downpipe' | 'exhaust-system' | 'headers';

export type Product = {
  id: number;
  title: string;
  handle: string;
  make: string;
  part: PartKind | string;
  /* Les lignes de compatibilité, imprimées telles quelles sur la fiche : c'est la
     réponse au frein n°1 du créneau (86 % des retours sont un mauvais fitment). */
  fitments: string[];
  features: string[];
  offroad: boolean;
  years: [number, number];
  fits: string[];
  price: number;
  priceMax: number;
  available: boolean;
  optionNames: string[];
  variants: Variant[];
  images: string[];
  url: string;
};

export type Catalog = {
  generated: string;
  shop: string;
  makes: Make[];
  products: Record<string, Product>;
};

/* Les lignes de fitment réellement exploitables.
 *
 * build-index.mjs tire ces lignes de la description Shopify, et sur 58 des 120 fiches
 * il ramasse aussi le corps du texte marketing : « Key Features », « Two Material
 * Choices: Go T304 stainless steel… ». Ça s'affichait tel quel dans l'encadré
 * « Built for these exact cars » — l'élément sur lequel repose tout l'argument de la
 * page. Un bloc de fitment qui contient de la publicité ne prouve plus rien.
 *
 * Une ligne de fitment commence par une année ou une plage d'années : c'est ce qui la
 * distingue d'une phrase de description. Le filtre s'efface s'il ne laisse rien — une
 * fiche comme la McLaren P1 décrit sa compatibilité sans millésime, et une liste vide
 * serait pire que le bruit.
 *
 * Le vrai correctif est dans l'extraction, côté build-index.mjs ; il demande de
 * régénérer le catalogue depuis Shopify. Ici on protège l'affichage tout de suite.
 */
const looksLikeFitment = (s: string) =>
  /^\s*(19|20)\d{2}\s*(\+|[-–—]\s*((19|20)\d{2}|present|\+)?)?/i.test(s);

export function fitmentLines(p: Product): string[] {
  const kept = p.fitments.filter(looksLikeFitment);
  return kept.length ? kept : p.fitments;
}

const PART_LABEL: Record<string, string> = {
  downpipe: 'Downpipes',
  'exhaust-system': 'Race exhaust',
  headers: 'Racing headers'
};

export const partLabel = (p: Product) => PART_LABEL[p.part] ?? p.part.replace(/-/g, ' ');

export const money = (n: number) =>
  `$${Number(n).toLocaleString('en-CA', { maximumFractionDigits: 0 })}`;

/* Le nom de fichier d'un logo de marque : « Mercedes-AMG » → « mercedes-amg ».
   Ici et pas dans lib/catalog.ts, parce que des composants clients en ont besoin et
   que lib/catalog.ts embarque les 360 ko du catalogue. */
export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
