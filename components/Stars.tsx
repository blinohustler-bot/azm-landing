import { formatRating, starFill } from '@/lib/reviewTypes';

/* Les étoiles, au demi-point près.
 *
 * Deux rangées de ★ superposées : la grise dessous, la lime au-dessus, la seconde
 * coupée en largeur à la note. Cinq glyphes plutôt que cinq SVG — ils suivent la
 * taille du texte sans réglage, et une note de 4.9 doit pouvoir montrer une étoile
 * presque pleine, ce qu'une grille de cinq icônes pleines ou vides ne sait pas faire.
 *
 * Les glyphes sont toujours masqués aux technologies d'assistance : sans ça un lecteur
 * d'écran lit dix caractères « étoile blanche » à la suite.
 *
 * `decorative` règle ce qui reste. Là où la note est écrite en chiffres juste à côté
 * — la pastille Google, la ligne de note d'une carte produit — les étoiles ne font que
 * redire ce que le texte dit déjà, et le composant s'efface entièrement. Là où elles
 * sont la seule information, comme au-dessus d'une citation, elles portent le libellé.
 *
 * Ce composant n'a pas de 'use client' mais la carte produit, qui en a un, l'importe :
 * il part donc aussi dans le bundle du navigateur. C'est sans conséquence — il ne lit
 * aucune donnée et n'importe que des fonctions pures de reviewTypes.
 */
export default function Stars({
  rating,
  size,
  decorative
}: {
  rating: number;
  size?: 'sm' | 'md';
  decorative?: boolean;
}) {
  return (
    <span
      className={`stars${size === 'md' ? ' stars--md' : ''}`}
      style={{ ['--fill' as string]: `${starFill(rating)}%` }}
      {...(decorative
        ? { 'aria-hidden': true }
        : { role: 'img', 'aria-label': `${formatRating(rating)} out of 5` })}
    >
      <span className="stars__track" aria-hidden="true">★★★★★</span>
      <span className="stars__fill" aria-hidden="true">★★★★★</span>
    </span>
  );
}
