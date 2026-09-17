'use client';

import { useEffect, useRef } from 'react';
import { flushPendingLead } from '@/lib/sendLead';

/* Reprend un lead que /api/lead n'a pas réussi à écrire.
 *
 * Monté sur l'écran des résultats, donc quelques secondes après l'échec — GHL a eu le
 * temps de revenir, ou le réseau du téléphone de se rattraper. Et comme il est monté à
 * chaque visite, un lead resté en carafe finit par passer même si la personne ferme
 * l'onglet et revient le lendemain.
 *
 * Sans danger à rejouer : /api/lead fait un upsert du contact et met à jour
 * l'opportunité ouverte existante plutôt que d'en créer une seconde.
 */
export default function LeadRetry() {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void flushPendingLead();
  }, []);
  return null;
}
