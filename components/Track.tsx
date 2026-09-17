'use client';

import { useEffect, useRef } from 'react';
import { track } from '@/lib/track';

/* Déclare un événement Meta à l'affichage d'un écran.
 *
 * Les écrans sont maintenant rendus par le serveur : il n'y a plus de fonction de
 * navigation où glisser un appel de tracking. Ce composant le fait à la place, une
 * seule fois par montage — `key` sur l'appelant suffit à le refaire tirer quand le
 * char change, et le garde-fou `sent` protège du double montage de React en dev.
 */
export default function Track({ event, data }: { event: string; data?: Record<string, unknown> }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    track(event, data);
  }, [event, data]);
  return null;
}
