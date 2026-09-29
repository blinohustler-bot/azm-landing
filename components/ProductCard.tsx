'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Stars from './Stars';
import { CONFIG } from '@/lib/config';
import { track } from '@/lib/track';
/* catalogTypes, jamais catalog : ce fichier est 'use client', et lib/catalog importe
   catalog.json — 360 ko qui partiraient dans le bundle du navigateur. La même règle
   vaut pour reviewTypes / reviews : la note arrive en propriété depuis StepResults,
   déjà réduite à la pièce affichée. */
import { fitmentLines, money, type Product } from '@/lib/catalogTypes';
import { formatMonth, formatRating, trimQuote, type Proof } from '@/lib/reviewTypes';

/* Le choix catless / catted n'est pas une option technique : c'est la question du son
   et de la légalité, celle qui bloque vraiment l'achat. On l'explique sous le
   sélecteur, en clair. */
function help(options: string[]) {
  const t = options.join(' ').toLowerCase();
  if (t.includes('catless') || t.includes('race')) {
    return (
      <>
        <b>Loudest, most aggressive.</b> No catalytic converters. Off-road and competition use
        only, not legal on public roads.
      </>
    );
  }
  if (t.includes('catted') || t.includes('high flow')) {
    return (
      <>
        <b>Keeps the converters.</b> Calmer at cold start and easier to live with daily, still
        opens up the flow.
      </>
    );
  }
  return null;
}

export default function ProductCard({
  product,
  shop,
  partLabel,
  priority,
  proof,
  pickable = false,
  picked = false,
  onPick,
  onVariant
}: {
  product: Product;
  shop: string;
  partLabel: string;
  priority: boolean;
  /* Vrai seulement quand l'écran montre plusieurs pièces. Sur 42 % des écrans il n'y
     en a qu'une, et proposer de « l'ajouter à la commande » n'aurait aucun sens. */
  pickable?: boolean;
  picked?: boolean;
  onPick?: (productId: number) => void;
  /* La variante change sous les sélecteurs : le panier combiné doit suivre ce
     choix-là, pas la variante par défaut. */
  onVariant?: (productId: number, chosen: { variantId: number; price: number }) => void;
  /* La note de CETTE pièce, ou null. Null est le cas courant : 30 fiches notées sur
     121, et 69 % des cartes affichées n'auront rien à montrer (mesuré le 2026-09-27
     sur les 118 écrans de résultats atteignables). Tout ce qui suit doit donc
     disparaître entièrement plutôt que laisser un gabarit vide — une carte avec
     « 0 avis » est pire qu'une carte sans ligne d'avis. */
  proof: Proof;
}) {
  /* On garde l'index d'origine de chaque option.
     L'ancienne page filtrait « Title » puis indexait v.options avec la position dans
     le tableau *filtré* : dès que « Title » n'aurait pas été en dernier, le sélecteur
     aurait lu la mauvaise option. Ici l'index suit l'option, pas sa place à l'écran. */
  const opts = useMemo(
    () =>
      product.optionNames
        .map((name, i) => ({ name, i }))
        .filter((o) => o.name && o.name !== 'Title'),
    [product.optionNames]
  );

  const [chosen, setChosen] = useState<string[]>(() =>
    product.optionNames.map((_, i) => product.variants[0]?.options[i] ?? '')
  );

  const current = useMemo(() => {
    if (!opts.length) return product.variants[0];
    return (
      product.variants.find((v) => opts.every((o) => v.options[o.i] === chosen[o.i])) ??
      product.variants[0]
    );
  }, [chosen, opts, product.variants]);

  /* On annonce la variante courante au parent, qui construit le panier combiné.
     L'effet ne se déclenche que sur un vrai changement d'identifiant ou de prix ;
     le parent ignore de son côté une annonce identique, ce qui coupe la boucle. */
  useEffect(() => {
    if (!onVariant || !current) return;
    onVariant(product.id, { variantId: current.id, price: current.price });
  }, [onVariant, product.id, current]);

  const tip = help(current?.options ?? []);
  const img = product.images[0];
  const fits = fitmentLines(product);

  const buyHref =
    `${shop}/cart/${current.id}:1?${CONFIG.UTM}&utm_content=${encodeURIComponent(product.handle)}`;

  return (
    <article className="card">
      <div className="card__media">
        {img ? (
          <Image
            src={img}
            alt={product.title}
            fill
            sizes="(min-width:760px) 50vw, 100vw"
            /* La première carte est souvent le plus grand élément de l'écran de
               résultats : elle se charge en priorité, les suivantes paresseusement. */
            priority={priority}
            quality={72}
          />
        ) : null}
        <span className="card__tag">{partLabel}</span>
      </div>

      <div className="card__body">
        <h3>{product.title}</h3>

        {/* La note de la pièce, juste sous son nom — la place où tout acheteur en
            ligne la cherche. Elle vient des avis déposés sur azmotorsport.ca, pas de
            Google : un avis Google porte sur le commerce et ne connaît aucun produit.
            Le libellé le dit, et c'est une obligation, pas une précaution de style. */}
        {proof ? (
          <p className="rating">
            <Stars rating={proof.rating} decorative />
            <b>{formatRating(proof.rating)}</b>
            <span>
              {proof.count} {proof.count === 1 ? 'review' : 'reviews'} on this part
            </span>
          </p>
        ) : null}

        {/* Le bloc de fitment attaque le frein n°1 du créneau : 86 % des retours de
            pièces en ligne sont un mauvais fitment. On l'imprime, on ne le cache pas. */}
        {fits.length ? (
          <div className="fitbox">
            <p className="fitbox__head">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="3.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              Built for these exact cars
            </p>
            <p className="fitbox__body">{fits.join(' · ')}</p>
          </div>
        ) : null}

        {product.features.length ? (
          <ul className="specs">
            {product.features.slice(0, 3).map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        ) : null}

        {/* L'avis se place après les caractéristiques et avant le sélecteur : le
            sélecteur, le prix et le bouton forment le bloc de décision, et rien ne
            doit s'intercaler dedans. Coupé à 180 caractères — le plus long avis
            récolté en fait 360, de quoi déformer la carte. */}
        {proof?.quote ? (
          <figure className="cardquote">
            <blockquote>{trimQuote(proof.quote.text)}</blockquote>
            <figcaption>
              <b>{proof.quote.name}</b>
              {proof.quote.date ? (
                <time dateTime={proof.quote.date}>{formatMonth(proof.quote.date)}</time>
              ) : null}
              <span>azmotorsport.ca</span>
            </figcaption>
          </figure>
        ) : null}

        {opts.length ? (
          <div className="opts">
            {opts.map((o) => {
              const values = Array.from(
                new Set(product.variants.map((v) => v.options[o.i]).filter(Boolean))
              );
              const id = `opt-${product.id}-${o.i}`;
              return (
                <div key={id}>
                  <label htmlFor={id}>{o.name}</label>
                  <select
                    id={id}
                    value={chosen[o.i] ?? ''}
                    onChange={(e) => {
                      const next = chosen.slice();
                      next[o.i] = e.target.value;
                      setChosen(next);
                    }}
                  >
                    {values.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </div>
              );
            })}
            {tip ? <p className="opt-help">{tip}</p> : null}
          </div>
        ) : null}

        <div className="price">
          <b>{money(current.price)}</b>
          <small>CAD</small>
          <span className={`stock ${current.available ? 'stock--in' : 'stock--out'}`}>
            {current.available ? 'In stock' : 'Built to order'}
          </span>
        </div>

        {/* Un seul bouton. « Ask a builder » doublait l'encadré qui suit la grille et
            offre le même numéro, il était mort sur ordinateur — CONFIG.TALK était vide,
            donc il retombait sur un lien tel: — et il prenait la moitié de la largeur
            au bouton qui vend. Le canal conversation n'est pas perdu : l'encadré sous
            la grille le propose une fois, après qu'on ait vu les options, c'est-à-dire
            au moment où la question « laquelle ? » se pose. */}
        <div className="card__actions">
          {/* Le paiement reste entièrement chez Shopify : ce lien ouvre le panier sur
              azmotorsport.ca, aucune donnée de paiement ne passe par cette page. */}
          <a
            className="btn"
            href={buyHref}
            onClick={() =>
              track('AddToCart', {
                content_ids: [String(current.id)],
                content_name: product.title,
                value: current.price,
                currency: 'CAD'
              })
            }
          >
            Buy now
          </a>
        </div>

        {/* La case n'apparaît que sur un écran à plusieurs pièces. Elle sert à
            construire une commande : Shopify remplace le panier à chaque lien
            /cart/<variante>:1, donc sans elle un client qui veut les downpipes ET
            l'échappement ne peut pas les commander ensemble. C'est une vraie case à
            cocher, pas un bouton déguisé : un lecteur d'écran doit l'annoncer comme
            telle, et son état doit se lire sans la couleur. */}
        {pickable ? (
          <label className="pick">
            <input
              type="checkbox"
              checked={picked}
              onChange={() => onPick?.(product.id)}
            />
            <span>{picked ? 'In your order' : 'Add to order'}</span>
          </label>
        ) : null}

        {/* La mention off-road n'apparaît que si aucune option ne l'explique déjà :
            l'aide sous le sélecteur dit la même chose, en plus clair. */}
        {product.offroad && !opts.length ? (
          <p className="note">
            Race (catless) versions are for off-road / competition use only.
          </p>
        ) : null}
      </div>
    </article>
  );
}
