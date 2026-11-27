/* La monnaie d'affichage, choisie par le visiteur (Sam, 27 nov. 2026).
 *
 * POURQUOI. 11 des 29 paniers LP abandonnés (28 oct.-27 nov.) étaient américains, et
 * Shopify leur montrait des USD au checkout alors que la LP affichait des CAD : le
 * montant changeait entre les deux pages. Le visiteur choisit maintenant sa monnaie
 * dans l'en-tête, partout sur la page, et le checkout s'ouvre dans la même.
 *
 * LES PRIX VIENNENT DE SHOPIFY, PAS D'UN TAUX. Shopify arrondit par marché (1 725,00 $ US,
 * 1 576,95 € pour les downpipes RS6 à 2 407 $ CA) : une conversion maison ne tomberait
 * jamais juste. /api/prices lit le prix exact de chaque variante sur
 * azmotorsport.ca/variants/<id>.js?country=XX, le même que le checkout facture.
 *
 * UNE MONNAIE = UN PAYS. Chez Shopify, la monnaie suit le marché du pays. Chaque monnaie
 * pointe vers un pays où AZM livre ; le lien panier porte `country=XX`, ce qui ouvre le
 * checkout dans cette monnaie (vérifié : FR → €, US → $ US). Les monnaies activées dans
 * Shopify mais sans livraison possible (JPY, KRW, HKD, SGD, MYR, ILS, RSD) ne sont pas
 * proposées : le client ne pourrait pas finir sa commande.
 */

export type Currency = { code: string; country: string; label: string };

export const CURRENCIES: readonly Currency[] = [
  { code: 'CAD', country: 'CA', label: 'CAD $' },
  { code: 'USD', country: 'US', label: 'USD $' },
  { code: 'EUR', country: 'FR', label: 'EUR €' },
  { code: 'GBP', country: 'GB', label: 'GBP £' },
  { code: 'AUD', country: 'AU', label: 'AUD $' },
  { code: 'NZD', country: 'NZ', label: 'NZD $' },
  { code: 'CHF', country: 'CH', label: 'CHF' },
  { code: 'AED', country: 'AE', label: 'AED' },
  { code: 'SAR', country: 'SA', label: 'SAR' },
  { code: 'SEK', country: 'SE', label: 'SEK kr' },
  { code: 'DKK', country: 'DK', label: 'DKK kr' },
  { code: 'PLN', country: 'PL', label: 'PLN zł' },
  { code: 'CZK', country: 'CZ', label: 'CZK Kč' },
  { code: 'HUF', country: 'HU', label: 'HUF Ft' },
  { code: 'RON', country: 'RO', label: 'RON lei' }
];

export const BASE = 'CAD';
export const CUR_COOKIE = 'azm_cur';

/* Pays de la bordure Vercel → monnaie par défaut, pour la première visite. Les pays de
   la zone euro qu'AZM dessert tombent sur l'euro ; tout le reste reste en CAD. */
const EURO = new Set(['AT', 'BE', 'BG', 'HR', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'IE',
  'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PT', 'SK', 'SI', 'NO', 'KW']);

export function currencyForCountry(country: string | null | undefined): string {
  const c = (country || '').toUpperCase();
  const direct = CURRENCIES.find((x) => x.country === c);
  if (direct) return direct.code;
  if (EURO.has(c)) return 'EUR';
  return BASE;
}

export function byCode(code: string | null | undefined): Currency | null {
  return CURRENCIES.find((c) => c.code === code) ?? null;
}

/* Le montant dans la monnaie choisie. Les monnaies à zéro décimale de Shopify (HUF ici)
   gardent leurs centimes quand Shopify en met ; Intl suit la convention ISO, ce qui
   correspond à ce que le checkout affiche. */
export function fmt(amount: number, code: string): string {
  const whole = Math.abs(amount - Math.round(amount)) < 0.005;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: code,
    currencyDisplay: code === 'CAD' || code === 'USD' ? 'narrowSymbol' : 'symbol',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2
  }).format(amount);
}
