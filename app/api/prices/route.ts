/* GET /api/prices?cur=EUR&ids=111,222 — le prix Shopify exact de ces variantes dans
 * cette monnaie (voir lib/currency.ts).
 *
 * Source : azmotorsport.ca/variants/<id>.js?country=XX, la même donnée publique que la
 * page produit du magasin, déjà arrondie par marché. Aucune clé, aucun secret. L'hôte est
 * fixe et les identifiants sont des nombres : rien d'autre ne peut être demandé.
 * Mise en cache une heure par variante et par pays (les taux de Shopify bougent une fois
 * par jour environ). Une variante qui ne répond pas est simplement absente : la carte
 * garde alors son prix en CAD plutôt qu'un chiffre faux.
 */

import { byCode } from '@/lib/currency';

const SHOP = 'https://azmotorsport.ca';
const MAX_IDS = 40;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': status === 200 ? 'public, max-age=600, s-maxage=3600' : 'no-store'
    }
  });

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cur = byCode(url.searchParams.get('cur'));
  if (!cur) return json({ error: 'currency' }, 400);

  const ids = Array.from(new Set((url.searchParams.get('ids') || '').split(',')))
    .filter((s) => /^\d{6,20}$/.test(s))
    .slice(0, MAX_IDS);
  if (!ids.length) return json({ error: 'ids' }, 400);

  const prices: Record<string, number> = {};
  await Promise.all(ids.map(async (id) => {
    try {
      const r = await fetch(`${SHOP}/variants/${id}.js?country=${cur.country}`, {
        headers: { Accept: 'application/json' },
        next: { revalidate: 3600 }
      });
      if (!r.ok) return;
      const v = (await r.json()) as { price?: number };
      if (typeof v.price === 'number') prices[id] = v.price / 100;
    } catch { /* variante absente : la carte reste en CAD */ }
  }));

  return json({ currency: cur.code, prices });
}
