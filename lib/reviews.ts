/* Les avis clients, lus côté serveur uniquement.
 *
 * DEUX SOURCES, QU'IL NE FAUT PAS CONFONDRE — c'est tout l'enjeu de ce fichier.
 *
 *   · Les avis Google (CONFIG.GOOGLE) portent sur le COMMERCE. Google Business
 *     Profile n'a aucune notion de produit : il n'existe pas d'avis Google sur un
 *     downpipe. C'est un chiffre unique, écrit à la main dans lib/config.ts.
 *   · Les avis de ce fichier viennent de l'app du magasin (Avada Air Reviews) et sont
 *     rattachés à une fiche produit. Ce ne sont PAS des avis Google.
 *
 * Les présenter comme des avis Google serait une fausse indication sur l'origine d'un
 * témoignage — interdit par la Loi sur la concurrence au Canada (art. 74.01, pratiques
 * commerciales trompeuses) et par la règle de la FTC sur les faux avis (16 CFR 465,
 * en vigueur depuis août 2024) pour le trafic américain. D'où les libellés distincts
 * dans les composants : « Google » d'un côté, « azmotorsport.ca » de l'autre.
 *
 * `import 'server-only'` est la même garde que dans lib/catalog.ts : reviews.json
 * n'a rien à faire dans le bundle du navigateur.
 *
 * Régénéré par `npm run reviews` (build-reviews.mjs) depuis les fiches Shopify.
 */

import 'server-only';
import raw from '@/reviews.json';
import catalog from '@/catalog.json';

export type { Review, ProductReviews, ReviewIndex, Proof } from './reviewTypes';
export { starFill, formatRating, formatMonth, isQuotable, trimQuote } from './reviewTypes';

import type { Proof, Review, ReviewIndex } from './reviewTypes';
import { isQuotable } from './reviewTypes';

const index = raw as unknown as ReviewIndex;

export const REVIEWS_GENERATED = index.generated;

/* Ce qu'on peut dire honnêtement du volume d'avis produit, sur l'écran d'accueil.
   `rated` est le nombre de fiches notées, pas le nombre de fiches : le catalogue en
   compte 121 et 30 seulement portent un avis. On affiche donc le nombre d'avis, qui
   est vrai, et jamais un pourcentage de couverture, qui serait un aveu. */
export const REVIEW_TOTALS = index.totals;

/* ── par produit ─────────────────────────────────────────────────────────── */

/* L'avis à montrer sur une carte : le plus long des avis présentables, parce que
   c'est celui qui dit quelque chose. À égalité, le plus récent. */
function bestQuote(reviews: Review[]): Review | null {
  const usable = reviews.filter(isQuotable);
  if (!usable.length) return null;
  return usable
    .slice()
    .sort((a, b) => b.text.length - a.text.length || b.date.localeCompare(a.date))[0];
}

export function proofFor(handle: string): Proof {
  const p = index.products[handle];
  if (!p || !p.count || p.rating == null) return null;
  return { rating: p.rating, count: p.count, quote: bestQuote(p.reviews) };
}

/* ── pour l'écran d'accueil ──────────────────────────────────────────────── */

export type FeaturedReview = {
  review: Review;
  /* La pièce dont parle l'avis : c'est ce qui le rend vérifiable plutôt que décoratif. */
  product: string;
  make: string;
};

type RawProduct = { handle: string; title: string; make: string };
const byHandle = new Map<string, RawProduct>(
  Object.values((catalog as { products: Record<string, RawProduct> }).products)
    .map((p) => [p.handle, p])
);

/* Les avis mis en avant sur l'écran 01.
 *
 * Choix déterministe : l'écran est rendu par le serveur et doit produire le même HTML
 * à chaque requête, sinon React se plaint à l'hydratation et le cache de Next sert
 * n'importe quoi. Donc aucun tirage au sort.
 *
 * Les bornes de longueur ne sont pas cosmétiques. En dessous de 60 caractères l'avis
 * ne prouve rien (« Excellent », « 🔥🔥 ») ; au-dessus de 240 il déborde de sa tuile
 * et il faudrait le couper au milieu d'une phrase — le plus long récolté en fait 360.
 *
 * Le plus long d'abord, pas le plus récent. Les deux tris ont été comparés sur les 43
 * avis éligibles : par date on obtient « couldnt be more happier with the result »,
 * par longueur on obtient l'avis qui nomme la voiture, l'option choisie et le
 * résultat. Personne ne vérifie la date d'un avis sur une page d'atterrissage ; tout
 * le monde en lit le texte.
 *
 * Un avis par pièce, un par personne, une marque par citation : trois témoignages du
 * même client ou de la même marque se lisent comme un montage, même quand ils sont
 * vrais — et le visiteur est justement en train de chercher SA marque dans la grille
 * juste au-dessus.
 */
export function featuredReviews(n = 3): FeaturedReview[] {
  const pool: FeaturedReview[] = [];

  for (const [handle, p] of Object.entries(index.products)) {
    const product = byHandle.get(handle);
    if (!product) continue;                     // fiche sortie du catalogue depuis la récolte
    for (const review of p.reviews) {
      if (review.rate < 4) continue;
      if (review.text.length < 60 || review.text.length > 240) continue;
      pool.push({ review, product: product.title, make: product.make });
    }
  }

  pool.sort((a, b) => b.review.text.length - a.review.text.length
    || b.review.date.localeCompare(a.review.date));

  const out: FeaturedReview[] = [];
  const seenProduct = new Set<string>();
  const seenName = new Set<string>();
  const seenMake = new Set<string>();
  const seenText = new Set<string>();
  for (const f of pool) {
    /* Le même avis peut être rattaché à deux fiches (downpipes + échappement du même
       client) : Air Reviews le recopie sur chacune. Sans ce filtre, l'écran 01
       afficherait deux fois le même témoignage. */
    const text = f.review.text.toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (seenProduct.has(f.product) || seenName.has(f.review.name)
      || seenMake.has(f.make) || seenText.has(text)) continue;
    seenProduct.add(f.product);
    seenName.add(f.review.name);
    seenMake.add(f.make);
    seenText.add(text);
    out.push(f);
    if (out.length === n) break;
  }
  return out;
}
