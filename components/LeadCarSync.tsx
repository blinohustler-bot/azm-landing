'use client';

import { useEffect, useRef } from 'react';
import { sendLead, type LeadPayload } from '@/lib/sendLead';

/* Ajoute le char au lead quand le formulaire est venu en premier.
 *
 * Version B de l'A/B gate1 : les coordonnées partent avant le choix du char, donc
 * l'opportunité GHL naît en « Char inconnu ». Sur l'écran des pièces, on renvoie le
 * même lead avec le char et les pièces. /api/lead fait un upsert du contact et met à
 * jour l'opportunité ouverte (nom, valeur) : pas de doublon, et une note de plus qui
 * porte les pièces.
 *
 * Seulement si le char a changé depuis le dernier envoi : revenir sur la même page ne
 * réécrit rien, essayer un deuxième char met l'opportunité à jour.
 */
export default function LeadCarSync({
  car,
  make,
  model,
  generation,
  parts
}: {
  car: string;
  make: string | null;
  model: string | null;
  generation: string | null;
  parts: { title: string; price: number }[];
}) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !car) return;
    done.current = true;

    let last: LeadPayload | null = null;
    try { last = JSON.parse(localStorage.getItem('azm_lead') || 'null'); } catch { /* rien */ }
    if (!last?.email || last.car === car) return;

    void sendLead({
      ...last,
      source: 'fitment_lp',
      car,
      make,
      model,
      generation,
      parts,
      page: window.location.href,
      company: ''
    });
  }, [car, make, model, generation, parts]);
  return null;
}
