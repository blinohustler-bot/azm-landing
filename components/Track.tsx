'use client';

import { useEffect, useRef } from 'react';
import { track, trackCustom } from '@/lib/track';

/* Déclare un événement Meta à l'affichage d'un écran.
 *
 * Les écrans sont maintenant rendus par le serveur : il n'y a plus de fonction de
 * navigation où glisser un appel de tracking. Ce composant le fait à la place, une
 * seule fois par montage — `key` sur l'appelant suffit à le refaire tirer quand le
 * char change, et le garde-fou `sent` protège du double montage de React en dev.
 */
export default function Track({ event, data, custom = false }: {
  event: string;
  data?: Record<string, unknown>;
  /** true = événement maison (fbq trackCustom) plutôt qu'un événement standard. */
  custom?: boolean;
}) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    (custom ? trackCustom : track)(event, data);
  }, [event, data, custom]);
  return null;
}
