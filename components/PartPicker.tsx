'use client';

import { useCallback, useState } from 'react';
import ProductCard from './ProductCard';
import { CONFIG } from '@/lib/config';
import { track } from '@/lib/track';
import { money, type Product } from '@/lib/catalogTypes';
import type { Proof } from '@/lib/reviewTypes';

/* Construire une commande de plusieurs pièces.
 *
 * LE PROBLEME QU'IL REGLE, MESURE ET PAS SUPPOSE. Le lien d'achat d'une carte est un
 * lien panier Shopify de la forme /cart/<variante>:1, et ce lien REMPLACE le panier.
 * Vérifié en cliquant avec un bocal à cookies : après « Buy now » sur les downpipes
 * puis sur l'échappement, le panier ne contenait plus que l'échappement. Or 58 % des
 * écrans de résultats affichent deux pièces ou plus. Panier médian d'une seule pièce :
 * 4 666 $. De toutes les pièces de l'écran : 6 857 $. Il y avait donc 2 789 $ médians
 * qu'on ne pouvait pas encaisser même quand le client les voulait.
 *
 * Shopify accepte plusieurs variantes dans le même lien, séparées par des virgules —
 * /cart/A:1,B:1 — et je l'ai vérifié sur la vraie boutique : deux articles, 5 347 $.
 *
 * POURQUOI DES CASES ET PAS UN SIMPLE « PRENDRE LES DEUX ». 80 % des écrans à
 * plusieurs pièces en ont exactement deux, et pour ceux-là un bouton unique suffirait.
 * Mais 12 % en ont trois, et là quelqu'un peut vouloir la première et la troisième.
 * Les cases couvrent les deux cas sans rien coûter au premier.
 *
 * Le bouton « Buy now » de chaque carte ne bouge pas : sur 42 % des écrans il n'y a
 * qu'une pièce, et pour le client qui n'en veut qu'une, un clic doit rester un clic.
 */

export type PickerPart = {
  product: Product;
  partLabel: string;
  proof: Proof;
};

/* La variante réellement choisie sur une carte. Elle change sous les sélecteurs
   (Race/High Flow, acier/titane), et le panier combiné doit suivre ce choix-là, pas
   la variante par défaut. */
type Chosen = { variantId: number; price: number };

export default function PartPicker({ parts, shop }: { parts: PickerPart[]; shop: string }) {
  const many = parts.length > 1;

  const [chosen, setChosen] = useState<Record<number, Chosen>>({});
  const [picked, setPicked] = useState<number[]>([]);

  /* Chaque carte annonce sa variante courante. On ne réécrit l'état que si elle a
     vraiment changé : sans cette garde, chaque rendu d'une carte relancerait un rendu
     du parent, qui relancerait la carte. */
  const reportVariant = useCallback((productId: number, next: Chosen) => {
    setChosen((prev) => {
      const now = prev[productId];
      if (now && now.variantId === next.variantId && now.price === next.price) return prev;
      return { ...prev, [productId]: next };
    });
  }, []);

  const toggle = useCallback((productId: number) => {
    setPicked((prev) =>
      prev.includes(productId) ? prev.filter((x) => x !== productId) : [...prev, productId]
    );
  }, []);

  /* L'ordre d'affichage, pas l'ordre de cochage : le récapitulatif doit se lire comme
     la grille. */
  const inOrder = parts.filter((p) => picked.includes(p.product.id));
  const lines = inOrder.map((p) => chosen[p.product.id]).filter(Boolean) as Chosen[];
  const total = lines.reduce((s, l) => s + l.price, 0);

  const cartHref = lines.length
    ? `${shop}/cart/${lines.map((l) => `${l.variantId}:1`).join(',')}?${CONFIG.UTM}`
      + `&utm_content=${encodeURIComponent(`bundle-${lines.length}`)}`
    : '';

  return (
    <>
      <div className={`grid${parts.length === 1 ? ' grid--one' : ''}`}>
        {parts.map((p, i) => (
          <ProductCard
            key={p.product.id}
            product={p.product}
            shop={shop}
            partLabel={p.partLabel}
            priority={i === 0}
            proof={p.proof}
            pickable={many}
            picked={picked.includes(p.product.id)}
            onPick={toggle}
            onVariant={reportVariant}
          />
        ))}
      </div>

      {/* La barre n'existe que quand elle a quelque chose à dire. Elle apparaît dès la
          première case cochée, et pas seulement à la deuxième : une case qui ne
          produit aucun retour visible se lit comme cassée. */}
      {many && lines.length > 0 ? (
        <div className="bundle" role="region" aria-label="Your order">
          <p className="bundle__sum">
            <b>{lines.length}</b>
            <span>{lines.length === 1 ? 'part selected' : 'parts selected'}</span>
            <em>{money(total)}</em>
          </p>
          <a
            className="btn"
            href={cartHref}
            onClick={() =>
              track('AddToCart', {
                content_ids: lines.map((l) => String(l.variantId)),
                content_name: `bundle of ${lines.length}`,
                value: total,
                currency: 'CAD'
              })
            }
          >
            {lines.length === 1 ? 'Buy this part' : `Buy these ${lines.length} together`}
          </a>
        </div>
      ) : null}
    </>
  );
}
