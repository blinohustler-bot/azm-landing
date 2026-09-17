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

  UTM: 'utm_source=meta&utm_medium=paid&utm_campaign=fitment_lp'
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
