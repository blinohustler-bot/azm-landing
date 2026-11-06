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

function httpsOn(url: unknown, hosts: string[]): url is string {
  if (typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && !u.username && !u.password && hosts.includes(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function isShopUrl(url: unknown, shop: string): url is string {
  return httpsOn(url, shopHosts(shop));
}

/* Les liens cliquables dans le TEXTE de Tyler (jamais pour CHECKOUT, qui garde la liste
   du magasin seul : il porte les coordonnées du visiteur). En plus du magasin : les
   vidéos (YouTube, Instagram) que find_video envoie, et la prise de rendez-vous de
   reprogrammation (GoRendezvous) de search_tuning. Hôtes exacts, https seulement. */
const TEXT_LINK_HOSTS = [
  'youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be',
  'instagram.com', 'www.instagram.com',
  'gorendezvous.com', 'www.gorendezvous.com'
];

export function isChatLinkUrl(url: unknown, shop: string): url is string {
  return httpsOn(url, [...shopHosts(shop), ...TEXT_LINK_HOSTS]);
}
