'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Stars from './Stars';
import { formatMonth, formatRating, type FeaturedReview } from '@/lib/reviewTypes';

/* Le rail d'avis de l'écran 01.
 *
 * CE QUI LE FAIT PARLER, C'EST LA PHOTO. Le bloc a d'abord été treize pavés de texte
 * gris de même taille : le contenu était bon — un gars qui nomme son M3 Comp, son
 * stage 2, ses 780 chevaux — et il se lisait comme des conditions d'utilisation.
 * Chaque avis déposé sur le magasin porte une photo prise par le client, de SON char.
 * Sur cette clientèle-là c'est la pièce la plus convaincante du dossier, et elle
 * dormait dans la source. La phrase dit qu'on a livré ; la photo montre sur quoi.
 *
 * L'en-tête porte maintenant la note, en gros. « 79 customer reviews » en gris de
 * 11 px sous un intertitre, c'était chuchoter le meilleur argument de la section.
 *
 * PAS D'AUTO-DÉFILEMENT. Ce qu'on reproche aux carrousels — la lecture coupée en
 * pleine phrase, le contenu qui échappe à qui lit lentement, l'impossibilité de
 * revenir — vient de la rotation, pas du défilement. La page porte déjà un bloc
 * `prefers-reduced-motion` qu'une rotation contredirait.
 *
 * Le défilement est du CSS (`scroll-snap`) : au doigt, à la molette horizontale et au
 * clavier, ça marche avant que ce fichier soit chargé. Les flèches sont un ajout pour
 * la souris, qui n'a pas de geste horizontal — si le JS ne s'exécute jamais, on perd
 * deux boutons, pas l'accès aux avis.
 *
 * La tuile suivante dépasse volontairement du cadre. C'est ce qui dit qu'il y en a
 * d'autres ; des flèches seules, sur une rangée qui semble pleine, ne le disent pas.
 */
export default function QuoteRail({
  quotes,
  rating,
  count
}: {
  quotes: FeaturedReview[];
  rating: number;
  count: number;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  /* Estimation du serveur : au-delà de trois tuiles ça dépasse forcément, même sur le
     plus large des écrans visés. La mesure réelle corrige après le montage — partir de
     `false` ferait apparaître les commandes après coup. */
  const [scrollable, setScrollable] = useState(quotes.length > 3);
  /* La part visible du rail et où elle se trouve, en pourcentage de la largeur totale.
     C'est ce que dessine la barre sous le rail : elle dit à la fois qu'il y a plus à
     voir et combien il en reste — ce qu'une flèche seule ne dit pas. */
  const [bar, setBar] = useState({ width: 100, left: 0 });

  const measure = useCallback(() => {
    const el = rail.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setScrollable(max > 2);
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft >= max - 2);
    setBar({
      width: (el.clientWidth / el.scrollWidth) * 100,
      left: (el.scrollLeft / el.scrollWidth) * 100
    });
  }, []);

  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    measure();
    /* Un simple écouteur `resize` sur window raterait le cas qui compte : la largeur
       du rail change aussi quand la barre de défilement de la page apparaît. */
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  const nudge = (dir: 1 | -1) => {
    const el = rail.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('.quote');
    const step = card ? card.offsetWidth + 12 : el.clientWidth * 0.8;
    /* Le défilement animé est un mouvement comme un autre : qui a demandé moins
       d'animation obtient un saut direct. */
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * step, behavior: still ? 'auto' : 'smooth' });
  };

  return (
    <div className="proof">
      <div className="proof__head">
        <p className="proof__lead">
          <span className="tech--label">After the install</span>
          <span className="proof__score">
            <Stars rating={rating} size="md" decorative />
            <b>{formatRating(rating)}</b>
            <span>
              {count} customer {count === 1 ? 'review' : 'reviews'} on azmotorsport.ca
            </span>
          </span>
        </p>
        {scrollable ? (
          <span className="proof__count">Showing {quotes.length} — swipe or use the arrows</span>
        ) : null}
      </div>

      {/* Les flèches sont SUR les bords du rail, pas rangées dans l'en-tête.
          Au-dessus, elles étaient loin du contenu et ne disaient pas que la rangée
          bouge ; la tuile qui dépasse, toute seule, ne le disait pas non plus. Là où
          elles chevauchent ce qu'elles déplacent, le geste est évident.
          Aux extrémités elles s'effacent au lieu de griser : une flèche morte posée
          sur une photo est du bruit, et sa disparition indique le sens restant. */}
      <div className="rail__wrap">
        {scrollable ? (
          <button
            type="button" className="rail__arrow rail__arrow--prev"
            onClick={() => nudge(-1)} disabled={atStart} aria-label="Previous reviews"
          >
            <Chevron dir="left" />
          </button>
        ) : null}

        {/* tabIndex sur une zone défilante : sans lui, ce qui dépasse à droite est
            inatteignable au clavier. C'est le WCAG 2.1.1, pas une finition. */}
        <div
          className="rail"
          ref={rail}
          onScroll={measure}
          tabIndex={0}
          role="group"
          aria-label={`Customer reviews — ${quotes.length} shown`}
        >
        {quotes.map((q, i) => (
          <figure className="quote" key={`${q.product}-${q.review.name}`}>
            {q.review.image ? (
              <div className="quote__shot">
                <Image
                  src={q.review.image}
                  /* Le texte alternatif décrit la photo, il ne répète pas l'avis :
                     le lecteur d'écran lit la citation juste en dessous. */
                  alt={`${q.make} owned by ${q.review.name}`}
                  fill
                  sizes="(min-width:760px) 30vw, 80vw"
                  quality={72}
                  /* Les trois premières sont les seules visibles sans défiler ; et
                     elles sont de toute façon sous la grille de marques, donc aucune
                     n'est prioritaire au chargement. */
                  loading={i < 3 ? 'eager' : 'lazy'}
                />
              </div>
            ) : null}
            <div className="quote__body">
              <Stars rating={q.review.rate} />
              <blockquote>{q.review.text}</blockquote>
              <figcaption>
                <b>{q.review.name}</b>
                <span>{q.product}</span>
                {q.review.date ? <time dateTime={q.review.date}>{formatMonth(q.review.date)}</time> : null}
              </figcaption>
            </div>
          </figure>
        ))}
        </div>

        {scrollable ? (
          <button
            type="button" className="rail__arrow rail__arrow--next"
            onClick={() => nudge(1)} disabled={atEnd} aria-label="Next reviews"
          >
            <Chevron dir="right" />
          </button>
        ) : null}
      </div>

      {/* La barre reprend l'idiome de la barre d'étapes en haut de page. Elle dit ce
          qu'une flèche ne dit pas : combien il reste. Purement indicative — la vraie
          commande est le rail lui-même, déjà atteignable au doigt et au clavier. */}
      {scrollable ? (
        <div className="rail__progress" aria-hidden="true">
          <i style={{ width: `${bar.width}%`, marginLeft: `${bar.left}%` }} />
        </div>
      ) : null}
    </div>
  );
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === 'left' ? 'M15 18 9 12l6-6' : 'M9 18l6-6-6-6'} />
    </svg>
  );
}
