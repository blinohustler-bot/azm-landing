/* Les réglages de campagne, en un seul endroit.
 *
 * Ce qui est ici part dans le navigateur : ce sont des valeurs publiques (un id de
 * pixel, un numéro de téléphone déjà publié). Rien de secret ne passe par ce fichier —
 * les identifiants GHL vivent dans process.env, côté serveur seulement.
 */

type Config = {
  LEAD_ENDPOINT: string;
  PHONE: string;
  PHONE_HREF: string;
  PIXEL: string;
  GATE_FIRST: boolean;
  UTM: string;
  GOOGLE: { RATING: number; COUNT: number; URL: string };
};

export const CONFIG: Config = {
  /* Le lead part vers notre propre fonction, qui écrit dans GHL. */
  LEAD_ENDPOINT: '/api/lead',

  /* Le canal conversation vit dans l'encadré sous la grille de résultats, qui donne ce
     numéro. Il y avait en plus un bouton « Ask a builder » sur chaque carte produit,
     réglé par un CONFIG.TALK resté vide : il retombait sur un lien tel:, mort sur
     ordinateur, et il prenait la moitié de la largeur au bouton qui vend. Le bouton et
     le réglage sont partis ensemble ; 84 % du revenu d'AZM se facture par conversation,
     mais l'offrir trois fois sur le même écran ne la vendait pas mieux. */
  PHONE: '581-745-8680',      // publié sur azmotorsport.ca
  PHONE_HREF: 'tel:+15817458680',

  PIXEL: '854592952776027',

  /* true = coordonnées AVANT le choix du char. Les taux de base disent que le gate en
     premier abandonne le plus ; c'est l'A/B à trancher sur le CPL servable, pas sur le
     nombre de leads. */
  GATE_FIRST: false,

  UTM: 'utm_source=meta&utm_medium=paid&utm_campaign=fitment_lp',

  /* La fiche Google du commerce. TENUE À LA MAIN, ET C'EST VOULU.
   *
   * Un avis Google porte sur l'entreprise, jamais sur une pièce : il n'y a rien à
   * rattacher à un produit ici, et rien à récolter automatiquement non plus — lire la
   * note en direct demanderait une clé Places API sur le chemin critique d'une page
   * payée par la pub. Deux valeurs, écrites ici, revérifiées avant chaque campagne.
   *
   * RATING — 4.9, lu sur la fiche Google (place ChIJkzZeE1APyUwREDBP53WmvAw) le
   *   2026-09-27. C'est aussi ce qu'affiche azmotorsport.ca.
   * COUNT  — 140, le chiffre qu'AZM publie sur son propre thème Shopify. NON CONFIRMÉ
   *   indépendamment : la fiche Google ne rend pas son total sans JavaScript. Un
   *   nombre d'avis faux dans une pub est précisément ce qui se fait signaler —
   *   à confirmer d'un coup d'œil sur la fiche avant de dépenser.
   *
   * Ces avis ne sont pas ceux de reviews.json. Voir l'en-tête de lib/reviews.ts. */
  GOOGLE: {
    RATING: 4.9,
    COUNT: 140,
    URL: 'https://www.google.com/maps/place/?q=place_id:ChIJkzZeE1APyUwREDBP53WmvAw'
  }
};

/* La photo qui ouvre la page.
 *
 * Une GT3 992 qui crache une flamme bleue dans une station-service, la nuit. C'est une
 * photo d'AZM, c'est leur pièce qui produit cette flamme, et aucune autre page ne l'a.
 * Elle servait de fond à 16 % d'opacité derrière les écrans 02 à 04 : une vraie photo
 * réduite à une texture.
 *
 * Elle est ici et pas en dur dans le composant parce que c'est un réglage de campagne :
 * une pub ciblée BMW mériterait la photo BMW. Les neuf collections d'AZM sont dans
 * catalog.json, champ `image` de chaque marque.
 *
 * L'hôte cdn.shopify.com est déjà déclaré dans next.config.ts > images.remotePatterns.
 */
export const HERO = {
  SRC: 'https://cdn.shopify.com/s/files/1/0794/1983/4643/collections/7U4A0572.jpg',
  ALT: 'A Porsche 911 GT3 shooting flame from an AZ Motorsport exhaust at a gas station at night'
} as const;

export type StepName = 'make' | 'model' | 'generation' | 'gate' | 'results' | 'missing' | 'thanks';

/* La barre de progression et le numéro d'étape lisent la même table : une étape
   ajoutée ne peut pas se retrouver numérotée à un endroit et pas à l'autre. */
export const STEP_INDEX: Record<StepName, number> = {
  make: 1,
  model: 2,
  generation: 3,
  gate: 4,
  results: 5,
  missing: 5,
  thanks: 5
};

export const TOTAL_STEPS = 5;
