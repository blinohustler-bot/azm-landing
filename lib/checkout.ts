'use client';

import { currentAb } from './sendLead';

/* Ce que le lien d'achat ajoute au panier Shopify, au moment du clic.
 *
 * 1. Le checkout pré-rempli. La personne a déjà donné nom, courriel et téléphone à
 *    l'étape 04 : les lui redemander chez Shopify, c'est un formulaire de plus entre
 *    elle et le paiement. Les liens panier Shopify acceptent checkout[email] et
 *    checkout[shipping_address][...] (doc Shopify « cart permalinks »).
 *
 * 2. Des attributs de panier, qui suivent la commande jusque dans l'admin Shopify
 *    (« Détails supplémentaires »). C'est ce qui permet de dire quelle commande vient
 *    de la landing, de quelle version A/B et pour quelle voiture — les utm, eux, se
 *    perdent dès que la personne revient plus tard par un autre chemin.
 *
 * Ajouté au clic et pas au rendu : le localStorage n'existe pas côté serveur, et un
 * lien différent entre serveur et navigateur casserait l'hydratation.
 */

type StoredLead = { name?: string; email?: string; phone?: string; car?: string };

function storedLead(): StoredLead {
  try {
    const raw = localStorage.getItem('azm_lead');
    return raw ? (JSON.parse(raw) as StoredLead) : {};
  } catch {
    return {};
  }
}

export function withCheckout(href: string): string {
  const lead = storedLead();
  const extra = new URLSearchParams();

  const email = lead.email?.trim();
  if (email) extra.set('checkout[email]', email);

  /* Un seul champ « nom » au formulaire : premier mot = prénom, le reste = nom. */
  const [first, ...rest] = (lead.name ?? '').trim().split(/\s+/).filter(Boolean);
  if (first) extra.set('checkout[shipping_address][first_name]', first);
  if (rest.length) extra.set('checkout[shipping_address][last_name]', rest.join(' '));

  const phone = lead.phone?.trim();
  if (phone) extra.set('checkout[shipping_address][phone]', phone);

  extra.set('attributes[source]', 'fitment_lp');
  if (lead.car) extra.set('attributes[car]', lead.car);
  const ab = currentAb();
  if (ab) extra.set('attributes[ab]', ab);

  return `${href}${href.includes('?') ? '&' : '?'}${extra.toString()}`;
}
