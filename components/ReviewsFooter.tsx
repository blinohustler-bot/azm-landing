import QuoteRail from './QuoteRail';
import { featuredReviews, PRODUCT_RATING, REVIEW_TOTALS } from '@/lib/reviews';

/* Les avis en bas de chaque écran, plus seulement sous la grille des marques.
 *
 * Rendu par app/page.tsx après l'écran courant : ils attrapent celui qui hésite, quelle
 * que soit l'étape où il décroche. Composant serveur, pour la même raison que partout
 * ailleurs : lib/reviews tire reviews.json, qui ne descend jamais dans le navigateur.
 * Seules les citations retenues partent dans QuoteRail. */
export default function ReviewsFooter() {
  const quotes = featuredReviews();
  if (!quotes.length) return null;

  return (
    <section className="wrap reviewsFooter" aria-label="Customer reviews">
      <QuoteRail quotes={quotes} rating={PRODUCT_RATING} count={REVIEW_TOTALS.reviews} />
    </section>
  );
}
