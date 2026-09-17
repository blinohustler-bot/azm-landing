import Link from 'next/link';
import ProductCard from './ProductCard';
import Track from './Track';
import { CONFIG } from '@/lib/config';
import { partLabel, type Product } from '@/lib/catalog';

/* 05 — les pièces.
 *
 * La coquille est rendue par le serveur : titres, blocs de fitment, caractéristiques,
 * mentions légales arrivent en HTML. Seule la carte produit est cliente, et seulement
 * pour ce qui bouge sous un sélecteur — le prix, le stock et le lien d'achat.
 *
 * Pas de checkout automatique, même quand une seule pièce est compatible. 42 % des
 * combinaisons de char ne donnent qu'une pièce, mais aucune n'a une seule variante :
 * il reste toujours le choix Race (catless) / High Flow (catted), c'est-à-dire *légal
 * sur route ou non*, et jusqu'à 1 600 $ d'écart. Choisir à la place du client serait
 * une faute.
 */
export default function StepResults({
  carName,
  parts,
  shop
}: {
  carName: string;
  parts: Product[];
  shop: string;
}) {
  const n = parts.length;

  return (
    <section className="screen wrap" aria-labelledby="step-title">
      <Track
        event="ViewContent"
        data={{ content_name: carName, content_type: 'vehicle_fitment', num_items: n }}
      />

      <div className="results__head">
        <span className="badge">
          {n} {n === 1 ? 'part' : 'parts'}
        </span>
        <h2 id="step-title">fit your {carName}</h2>
        <Link className="btn btn--ghost results__change" href="/" scroll={false}>
          Change car
        </Link>
      </div>

      <div className={`grid${n === 1 ? ' grid--one' : ''}`}>
        {parts.map((p, i) => (
          <ProductCard
            key={p.id}
            product={p}
            shop={shop}
            partLabel={partLabel(p)}
            priority={i === 0}
          />
        ))}
      </div>

      <p className="callout">
        Not sure which one you want? <a href={CONFIG.PHONE_HREF}>Call {CONFIG.PHONE}</a> — a builder
        confirms the fit and the sound before you order.
      </p>

      <div className="reassure">
        <div>
          <b>The fitment is printed</b>
          <p>
            Every part lists the exact years and chassis codes it was built for. If your car
            isn&rsquo;t on that line, don&rsquo;t buy — call us instead.
          </p>
        </div>
        <div>
          <b>304 stainless, TIG-welded</b>
          <p>
            CNC-machined flanges, OEM mounting points, direct bolt-on. No cutting, no welding on
            your car.
          </p>
        </div>
        <div>
          <b>Catless is off-road only</b>
          <p>
            Race (catless) parts aren&rsquo;t legal for road use or on vehicles that must meet
            emissions rules in Canada or the US. High Flow (catted) is listed where it exists.
          </p>
        </div>
      </div>
    </section>
  );
}
