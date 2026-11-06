'use client';

import { useCallback, useRef, useState } from 'react';
import Image from 'next/image';

/* Les photos d'une carte produit, quand il y en a plusieurs.
 *
 * 31 fiches ont trois photos ou plus (la pièce sous plusieurs angles, la soudure, la
 * bride) ; la carte n'en montrait qu'une. Le visiteur hésite sur le choix de la pièce
 * (Clarity, 2026-11-06) : voir la pièce de près est une partie de la réponse.
 *
 * MÊME MÉCANIQUE QUE QuoteRail, et pour les mêmes raisons :
 * - Le défilement est du CSS (`scroll-snap`). Au doigt il marche avant que ce fichier
 *   soit chargé ; sans JavaScript on perd les flèches, pas les photos.
 * - Aucun auto-défilement. Une photo qui change toute seule pendant qu'on lit le prix
 *   juste en dessous est un mouvement qu'on n'a pas demandé.
 * - Les flèches sont pour la souris, qui n'a pas de geste horizontal. Elles ne
 *   s'affichent que sur un pointeur fin (voir .gallery__arrow dans globals.css) : au
 *   doigt, elles masqueraient la photo pour un geste que le pouce fait déjà.
 *
 * Le compteur « 2 / 4 » plutôt que des points : il dit en un coup d'œil combien il y
 * en a, en chiffres tabulaires, sans ajouter une rangée de pastilles sur la photo.
 *
 * CHARGEMENT. La première photo se comporte exactement comme avant (prioritaire sur
 * la première carte de l'écran). Les suivantes sont paresseuses : le navigateur ne
 * les demande qu'à l'approche, défilement horizontal compris.
 */
export default function CardGallery({
  images,
  alt,
  priority,
  sizes
}: {
  images: string[];
  alt: string;
  priority: boolean;
  sizes: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const n = images.length;

  const measure = useCallback(() => {
    const el = track.current;
    if (!el || !el.clientWidth) return;
    setAt(Math.min(n - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth))));
  }, [n]);

  const go = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    /* Qui a demandé moins d'animation obtient un saut direct. */
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * el.clientWidth, behavior: still ? 'auto' : 'smooth' });
  };

  return (
    <div className="gallery">
      {/* tabIndex : sans lui, les photos qui dépassent à droite sont inatteignables
          au clavier (WCAG 2.1.1) — même règle que le rail d'avis. */}
      <div
        className="gallery__track"
        ref={track}
        onScroll={measure}
        tabIndex={0}
        role="group"
        aria-roledescription="carousel"
        aria-label={`${alt}, ${n} photos`}
      >
        {images.map((src, i) => (
          <div
            className="gallery__slide"
            key={src}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${n}`}
          >
            <Image
              src={src}
              alt={i === 0 ? alt : `${alt}, photo ${i + 1}`}
              fill
              sizes={sizes}
              priority={priority && i === 0}
              loading={priority && i === 0 ? undefined : 'lazy'}
              quality={72}
            />
          </div>
        ))}
      </div>

      <button
        type="button" className="gallery__arrow gallery__arrow--prev"
        onClick={() => go(-1)} disabled={at === 0} aria-label="Previous photo"
      >
        <Chevron dir="left" />
      </button>
      <button
        type="button" className="gallery__arrow gallery__arrow--next"
        onClick={() => go(1)} disabled={at === n - 1} aria-label="Next photo"
      >
        <Chevron dir="right" />
      </button>

      <span className="gallery__count" aria-hidden="true">
        {at + 1} / {n}
      </span>
    </div>
  );
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === 'left' ? 'M15 18 9 12l6-6' : 'M9 18l6-6-6-6'} />
    </svg>
  );
}
