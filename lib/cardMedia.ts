/* Ce que la carte produit reçoit en plus du produit : sa vidéo, ses tags.
 *
 * Importable côté client, comme catalogTypes et reviewTypes : aucune donnée ici,
 * seulement des types et des fonctions pures. Les données (videos.json,
 * bestsellers.json) sont lues côté serveur par lib/videos.ts et lib/bestsellers.ts,
 * et descendent en propriétés déjà réduites à la carte affichée.
 */

import type { Proof } from './reviewTypes';

/* ── la vidéo ────────────────────────────────────────────────────────────── */

/* Une vidéo de la chaîne d'AZ qui montre CE char avec CE type de pièce. `label` est
   le char tel qu'il est nommé à l'écran, article compris (« a G80 M3 »). `vertical`
   vaut true pour un Short — 196 des 201 vidéos de la chaîne. Null est le cas
   courant : la carte n'affiche alors rien de plus. */
export type CardVideo = { id: string; label: string; vertical: boolean } | null;

/* youtube-nocookie : pas de cookie YouTube tant que la personne ne lance pas la
   lecture, et c'est le seul hôte de cadre ajouté à la CSP.
   playsinline=1 : sans lui, Safari iOS — et donc le navigateur intégré d'Instagram —
   ouvre la vidéo en plein écran au lieu de la jouer dans la carte.
   rel=0 : les suggestions de fin restent sur la chaîne d'AZ.
   autoplay=1 : l'iframe n'existe qu'après le tap, qui est le geste utilisateur qui
   autorise le son ; sans autoplay il faudrait taper une deuxième fois. */
export const embedUrl = (id: string) =>
  `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?playsinline=1&rel=0&autoplay=1`;

/* ── les tags ────────────────────────────────────────────────────────────── */

/* La copie exacte, en anglais comme le reste de l'écran. Pas d'emoji : DESIGN.md
   interdit l'icône décorative, et cinq pictogrammes de couleur sur une carte sombre
   sont précisément ce qui fait qu'une page se lit comme générée. */
export type CardTag = 'Best seller' | 'Top rated' | 'Max power' | 'Daily friendly' | 'Ships free';

/* L'ordre de priorité, et le plafond. Deux tags se lisent ; quatre deviennent un
   décor qu'on ne lit plus. */
const ORDER: CardTag[] = ['Best seller', 'Top rated', 'Max power', 'Daily friendly', 'Ships free'];
export const MAX_TAGS = 2;

/* Les seuils de « Top rated » : 4,9 sur au moins trois avis. Une seule note de 5 ne
   prouve rien, et sous 4,9 « top » cesse d'être vrai sur une boutique notée 4,9. */
export const TOP_RATED_MIN = 4.9;
export const TOP_RATED_COUNT = 3;

export type TagInput = {
  /* Calculé hors ligne (tools/build-bestsellers.mjs), vrai seulement si la pièce est
     la plus vendue de l'écran affiché. Faux tant que bestsellers.json est vide. */
  bestSeller: boolean;
  proof: Proof;
  /* `part` du catalogue : 'downpipe', 'exhaust-system', 'headers'. */
  part: string;
  /* Les valeurs d'option de la variante SÉLECTIONNÉE : les tags qui en dépendent
     changent avec le sélecteur. */
  selected: string[];
  price: number;
  freeShipMin: number;
};

/* Chaque tag est une affirmation, et chacune doit être vraie pour la variante à
   l'écran. Aucun tag n'est déduit d'un texte marketing. */
export function cardTags(t: TagInput): CardTag[] {
  const sel = t.selected.join(' | ');
  const catless = /catless/i.test(sel);
  const catted = /catted|high flow/i.test(sel);
  /* « Valve Config » (OEM Valves / Remote Valves) ou « Valved (Street/Track) » : la
     variante choisie garde des valves, donc un mode calme. « Straight-Pipe (Race) »
     n'en a pas, et le tag disparaît quand on la choisit. */
  const valved = t.part === 'exhaust-system' && /valve/i.test(sel);

  const on = new Set<CardTag>();
  if (t.bestSeller) on.add('Best seller');
  if (t.proof && t.proof.rating >= TOP_RATED_MIN && t.proof.count >= TOP_RATED_COUNT) on.add('Top rated');
  if (catless) on.add('Max power');
  else if (catted || valved) on.add('Daily friendly');
  if (t.price >= t.freeShipMin) on.add('Ships free');

  return ORDER.filter((x) => on.has(x)).slice(0, MAX_TAGS);
}
