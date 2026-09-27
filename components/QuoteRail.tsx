'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Stars from './Stars';
import { formatMonth, type FeaturedReview } from '@/lib/reviewTypes';

/* Le rail d'avis de l'écran 01.
 *
 * PAS D'AUTO-DÉFILEMENT, ET C'EST LE POINT PRINCIPAL. Ce qu'on reproche aux
 * carrousels — la lecture interrompue au milieu d'une phrase, le contenu qui échappe
 * à qui lit lentement, l'impossibilité de revenir — vient de la rotation automatique,
 * pas du défilement. Le rail bouge quand la personne le décide, jamais tout seul. La
 * page porte déjà un bloc `prefers-reduced-motion` : une rotation automatique le
 * contredirait de toute façon.
 *
 * Le défilement est du CSS (`scroll-snap`), pas du JavaScript : au doigt, à la molette
 * horizontale et au clavier, ça marche avant que ce fichier soit chargé. Les flèches
 * sont un ajout pour la souris, qui n'a pas de geste horizontal naturel — si le JS ne
 * s'exécute jamais, on perd deux boutons, pas l'accès aux avis.
 *
 * La tuile suivante dépasse volontairement du cadre. C'est ce qui dit qu'il y en a
 * d'autres ; des flèches seules, sur une rangée qui semble pleine, ne le disent pas.
 */
export default function QuoteRail({
  quotes,
  label
}: {
  quotes: FeaturedReview[];
  label: string;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  /* Estimation du serveur : au-delà de trois tuiles ça dépasse forcément, même sur le
     plus large des écrans visés. La mesure réelle corrige après le montage — partir de
     `false` ferait apparaître les flèches après coup et décalerait l'en-tête. */
  const [scrollable, setScrollable] = useState(quotes.length > 3);

  const measure = useCallback(() => {
    const el = rail.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setScrollable(max > 2);
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft >= max - 2);
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
      <p className="proof__head">
        <span className="tech--label">After the install</span>
        <span className="proof__src">{label}</span>
        {scrollable ? (
          <span className="rail__nav">
            <button type="button" onClick={() => nudge(-1)} disabled={atStart} aria-label="Previous reviews">
              <Chevron dir="left" />
            </button>
            <button type="button" onClick={() => nudge(1)} disabled={atEnd} aria-label="Next reviews">
              <Chevron dir="right" />
            </button>
          </span>
        ) : null}
      </p>

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
        {quotes.map((q) => (
          <figure className="quote" key={`${q.product}-${q.review.name}`}>
            <Stars rating={q.review.rate} />
            <blockquote>{q.review.text}</blockquote>
            <figcaption>
              <b>{q.review.name}</b>
              <span>{q.product}</span>
              {q.review.date ? <time dateTime={q.review.date}>{formatMonth(q.review.date)}</time> : null}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === 'left' ? 'M15 18 9 12l6-6' : 'M9 18l6-6-6-6'} />
    </svg>
  );
}
