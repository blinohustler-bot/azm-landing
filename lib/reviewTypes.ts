/* Les types des avis clients, et les fonctions qui ne lisent aucune donnée.
 *
 * Même découpe que catalogTypes / catalog, et pour la même raison : ce fichier-ci est
 * importable depuis un composant 'use client', lib/reviews.ts ne l'est pas. La carte
 * produit est cliente et a besoin du type d'un avis ; si elle l'importait du fichier
 * qui fait `import raw from '@/reviews.json'`, le fichier entier partirait dans le
 * bundle du navigateur. C'est exactement l'accident déjà survenu avec catalog.json —
 * voir l'en-tête de lib/catalogTypes.ts.
 */

export type Review = {
  /* « Jean Pierre T. » — le format déjà utilisé par la fiche Shopify. */
  name: string;
  rate: number;
  text: string;
  /* AAAA-MM-JJ. Vide quand l'app source n'a pas horodaté l'avis. */
  date: string;
  country: string;
  verified: boolean;
};

export type ProductReviews = {
  rating: number | null;
  count: number;
  /* Les dix premiers avis de la fiche, c'est tout ce que Shopify rend côté serveur. */
  reviews: Review[];
};

export type ReviewIndex = {
  generated: string;
  shop: string;
  totals: { handles: number; rated: number; reviews: number; quoted: number };
  products: Record<string, ProductReviews>;
};

/* Ce qu'une carte produit reçoit : la note de la pièce et, s'il y en a un de
   présentable, un avis. `null` quand la pièce n'a aucun avis — c'est le cas de 69 %
   des fiches du catalogue (30 notées sur 121, mesuré le 2026-09-27), donc l'absence
   est le cas courant et pas l'exception. Tout ce qui affiche cette valeur doit
   disparaître proprement, pas laisser un cadre vide. */
export type Proof = {
  rating: number;
  count: number;
  quote: Review | null;
} | null;

/* La note arrondie au demi-point, pour le remplissage des étoiles. */
export const starFill = (rating: number) => Math.max(0, Math.min(100, (rating / 5) * 100));

/* « 4.9 », pas « 4.90 » ni « 5 » — un point décimal exactement, comme sur la fiche. */
export const formatRating = (rating: number) => rating.toFixed(1);

/* Un avis assez long pour prouver quelque chose. « 🔥🔥 » et « Excellent » comptent
   dans la note mais ne convainquent personne, et occupent la même place à l'écran
   qu'une phrase utile. 40 caractères écarte les 10 avis trop courts sur 74 sans
   toucher aux autres (mesuré sur reviews.json). */
export const isQuotable = (r: Review) => r.text.length >= 40;

/* « 2026-08-15 » → « Aug 2026 ». Le jour exact n'apporte rien et donne à la ligne
   l'allure d'un reçu ; le mois suffit à dire que l'avis est récent.
   Découpage manuel plutôt que `new Date()` : une date ISO sans heure est lue en UTC,
   et un rendu serveur au Québec (UTC−4) affichait le mois précédent pour tout avis
   déposé un premier du mois. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function formatMonth(date: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(date);
  if (!m) return '';
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${month} ${m[1]}` : '';
}

/* Coupe une citation trop longue sur la dernière frontière de mot. Le plus long avis
   récolté fait 360 caractères — de quoi déformer une carte produit. */
export function trimQuote(text: string, max = 180): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const at = cut.lastIndexOf(' ');
  return (at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[.,;:!?\s]+$/, '') + '…';
}
