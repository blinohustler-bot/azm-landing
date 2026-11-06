'use client';

import { useRef, useState } from 'react';
import { track } from '@/lib/track';
import { embedUrl, type CardVideo } from '@/lib/cardMedia';

declare global {
  interface Window { clarity?: (...args: unknown[]) => void }
}

/* « Hear it on a G80 M3 » — la vidéo d'AZ, sur le char du visiteur, dans la carte.
 *
 * Chez AZM ce qui vend, c'est le son sur un vrai char précis. La chaîne YouTube en a
 * 201 ; la carte n'en montrait aucune. La vidéo est choisie au build
 * (build-videos.mjs) et seulement quand elle montre le même char et le même type de
 * pièce — voir lib/videos.ts.
 *
 * RIEN N'EST CHARGÉ AVANT LE TAP. Pas d'iframe, pas de vignette, pas de script
 * YouTube : un lecteur intégré pèse plusieurs centaines de ko et ouvre des connexions
 * vers Google, sur une page payée par la pub et regardée au téléphone. Le bouton est
 * du HTML ; l'iframe naît au tap.
 *
 * Le tap est aussi le geste qui autorise le son (autoplay=1 dans embedUrl), et
 * playsinline garde la vidéo dans la carte sur iOS — c'est-à-dire dans le navigateur
 * intégré d'Instagram, d'où vient le trafic.
 *
 * Fermer RETIRE l'iframe : c'est la seule façon sûre d'arrêter le son sans charger
 * l'API JavaScript de YouTube.
 */
export default function HearIt({
  video,
  handle,
  productTitle
}: {
  video: NonNullable<CardVideo>;
  handle: string;
  productTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);

  const play = () => {
    setOpen(true);
    track('ViewContent', {
      content_name: 'video',
      content_type: 'video',
      content_ids: [handle],
      video_id: video.id
    });
    /* Clarity : un tag de session, pour filtrer les enregistrements de ceux qui ont
       écouté. Absent si Clarity n'est pas chargé (bloqueur) — jamais bloquant. */
    try { window.clarity?.('set', 'video_play', handle); } catch { /* rien */ }
  };

  const close = () => {
    setOpen(false);
    /* Le focus revient au bouton qui a ouvert : sans ça, un clavier repart du haut. */
    requestAnimationFrame(() => opener.current?.focus());
  };

  if (!open) {
    return (
      <button type="button" className="hear" ref={opener} onClick={play}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" />
        </svg>
        Hear it on {video.label}
      </button>
    );
  }

  return (
    <div className={`player${video.vertical ? ' player--tall' : ''}`}>
      <iframe
        src={embedUrl(video.id)}
        title={`${productTitle} on ${video.label.replace(/^an? /, '')}, AZ Motorsport video`}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        /* YouTube refuse désormais la lecture intégrée sans référent (erreur 153). La
           politique du site est déjà celle-ci ; on la répète là où elle compte. */
        referrerPolicy="strict-origin-when-cross-origin"
      />
      <button type="button" className="player__close" onClick={close}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="3" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
        Close video
      </button>
    </div>
  );
}
