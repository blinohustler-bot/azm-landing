/* Les adresses du magasin, et rien d'autre.
 *
 * CHECKOUT passe par withCheckout, qui ajoute au lien le courriel, le nom et le
 * téléphone du visiteur : ce lien ne doit JAMAIS mener ailleurs que chez le magasin.
 * Une proposition de Tyler (ou un lien dans son texte) n'est acceptée que si elle est
 * en https et vise l'hôte du magasin (la valeur `shop` du catalogue, avec ou sans
 * www). Fonctions pures, importables côté client comme côté serveur.
 */

function shopHosts(shop: string): string[] {
  try {
    const h = new URL(shop).hostname.toLowerCase();
    const bare = h.replace(/^www\./, '');
    return [bare, `www.${bare}`];
  } catch {
    return [];
  }
}

export function isShopUrl(url: unknown, shop: string): url is string {
  if (typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && !u.username && !u.password && shopHosts(shop).includes(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}
