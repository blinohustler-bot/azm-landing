/* Les réglages de campagne, en un seul endroit.
 *
 * Ce qui est ici part dans le navigateur : ce sont des valeurs publiques (un id de
 * pixel, un numéro de téléphone déjà publié). Rien de secret ne passe par ce fichier —
 * les identifiants GHL vivent dans process.env, côté serveur seulement.
 */

type Config = {
  LEAD_ENDPOINT: string;
  TALK: string;
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

  /* Lien de conversation (m.me de la Page). Vide → le bouton retombe sur le téléphone.
     84 % du revenu d'AZM se facture par conversation : on ne cache pas ce canal. */
  TALK: '',

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
